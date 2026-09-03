"""
The computer opponent: a static evaluation function and an
alpha-beta search on top of it, tuned differently per difficulty
level. Pure with one deliberate exception -- the search is time-
budgeted (it calls time.monotonic()), because "impossible" needs to
use whatever time it's given rather than a fixed, possibly very slow,
depth.

Honest scope note: this is a hobby-strength engine, not a chess
engine you'd measure in Elo against Stockfish. "Impossible" means
"about as strong as this design can get within a few seconds per
move" -- plenty to beat casual players, not superhuman.
"""

import random
import time

from chess_check import is_in_check
from chess_logic import apply_move
from chess_special import generate_legal_moves

PIECE_VALUES = {"P": 100, "N": 320, "B": 330, "R": 500, "Q": 900, "K": 0}

MATE_SCORE = 100_000
_INF = float("inf")

# Tomasz Michniewski's "Simplified Evaluation Function" piece-square
# tables -- one commonly-reproduced table per piece type, indexed
# a8..h8, a7..h7, ... a1..h1 (i.e. already in this project's row-0-is-
# rank-8 order for White; Black's score for a square is looked up by
# mirroring the row).
_PST = {
    "P": [
        0, 0, 0, 0, 0, 0, 0, 0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5, 5, 10, 25, 25, 10, 5, 5,
        0, 0, 0, 20, 20, 0, 0, 0,
        5, -5, -10, 0, 0, -10, -5, 5,
        5, 10, 10, -20, -20, 10, 10, 5,
        0, 0, 0, 0, 0, 0, 0, 0,
    ],
    "N": [
        -50, -40, -30, -30, -30, -30, -40, -50,
        -40, -20, 0, 0, 0, 0, -20, -40,
        -30, 0, 10, 15, 15, 10, 0, -30,
        -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30,
        -30, 5, 10, 15, 15, 10, 5, -30,
        -40, -20, 0, 5, 5, 0, -20, -40,
        -50, -40, -30, -30, -30, -30, -40, -50,
    ],
    "B": [
        -20, -10, -10, -10, -10, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 10, 10, 5, 0, -10,
        -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10,
        -10, 10, 10, 10, 10, 10, 10, -10,
        -10, 5, 0, 0, 0, 0, 5, -10,
        -20, -10, -10, -10, -10, -10, -10, -20,
    ],
    "R": [
        0, 0, 0, 0, 0, 0, 0, 0,
        5, 10, 10, 10, 10, 10, 10, 5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        0, 0, 0, 5, 5, 0, 0, 0,
    ],
    "Q": [
        -20, -10, -10, -5, -5, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 5, 5, 5, 0, -10,
        -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5,
        -10, 5, 5, 5, 5, 5, 0, -10,
        -10, 0, 5, 0, 0, 0, 0, -10,
        -20, -10, -10, -5, -5, -10, -10, -20,
    ],
    "K": [
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -20, -30, -30, -40, -40, -30, -30, -20,
        -10, -20, -20, -20, -20, -20, -20, -10,
        20, 20, 0, 0, 0, 0, 20, 20,
        20, 30, 10, 0, 0, 10, 30, 20,
    ],
}

DIFFICULTY_PRESETS = {
    "facile": {"mode": "random"},
    "moyen": {"mode": "search", "max_depth": 2, "time_budget": 2.0, "quiescence": False},
    "difficile": {"mode": "search", "max_depth": 4, "time_budget": 3.0, "quiescence": True},
    "impossible": {"mode": "search", "max_depth": 8, "time_budget": 5.0, "quiescence": True},
}


class _SearchAborted(Exception):
    """Raised when the time budget runs out mid-search."""


def _pst_value(piece_type, row, col, color):
    table_row = row if color == "w" else 7 - row
    return _PST[piece_type][table_row * 8 + col]


def evaluate(state):
    """Static material + position score, positive is good for White."""
    score = 0
    for row in range(8):
        for col in range(8):
            piece = state["board"][row][col]
            if piece is None:
                continue
            value = PIECE_VALUES[piece["type"]] + _pst_value(piece["type"], row, col, piece["color"])
            score += value if piece["color"] == "w" else -value
    return score


def _score_for_mover(state):
    score = evaluate(state)
    return score if state["turn"] == "w" else -score


def _move_order_key(move):
    """MVV-LVA: try promising captures first so alpha-beta cuts more."""
    if move["captured"] is None:
        return 0
    return PIECE_VALUES[move["captured"]["type"]] * 10 - PIECE_VALUES[move["piece"]["type"]]


def _ordered_moves(moves):
    return sorted(moves, key=_move_order_key, reverse=True)


def _check_deadline(deadline):
    if time.monotonic() > deadline:
        raise _SearchAborted()


def _quiescence(state, alpha, beta, deadline, qdepth=0, max_qdepth=6):
    """
    Keep searching captures past the nominal search horizon so the
    static eval is never taken mid-exchange (the "horizon effect") --
    e.g. stopping right after a queen takes a pawn but before seeing
    it gets recaptured for free.
    """
    _check_deadline(deadline)

    stand_pat = _score_for_mover(state)
    if stand_pat >= beta:
        return beta
    alpha = max(alpha, stand_pat)
    if qdepth >= max_qdepth:
        return stand_pat

    captures = _ordered_moves([m for m in generate_legal_moves(state) if m["captured"] is not None])
    for move in captures:
        child = apply_move(state, move)
        score = -_quiescence(child, -beta, -alpha, deadline, qdepth + 1, max_qdepth)
        if score >= beta:
            return beta
        alpha = max(alpha, score)
    return alpha


def _negamax(state, depth, alpha, beta, deadline, quiescence):
    _check_deadline(deadline)

    moves = generate_legal_moves(state)
    if not moves:
        if is_in_check(state, state["turn"]):
            return -(MATE_SCORE + depth), None
        return 0, None

    if depth == 0:
        score = _quiescence(state, alpha, beta, deadline) if quiescence else _score_for_mover(state)
        return score, None

    best_score = -_INF
    best_move = moves[0]
    for move in _ordered_moves(moves):
        child = apply_move(state, move)
        score, _ = _negamax(child, depth - 1, -beta, -alpha, deadline, quiescence)
        score = -score
        if score > best_score:
            best_score = score
            best_move = move
        alpha = max(alpha, score)
        if alpha >= beta:
            break

    return best_score, best_move


def choose_move_by_search(state, max_depth, time_budget, quiescence=True):
    """
    Iterative deepening: search depth 1, then 2, then 3, ... keeping
    the best move found by the last *fully completed* depth. If the
    time budget runs out mid-search at some depth, that depth's
    partial result is discarded (it only explored some root moves,
    not necessarily the best one) and the previous depth's move is
    used instead.
    """
    legal_moves = generate_legal_moves(state)
    if not legal_moves:
        return None

    deadline = time.monotonic() + time_budget
    best_move = legal_moves[0]
    depth = 1
    while depth <= max_depth:
        try:
            score, move = _negamax(state, depth, -_INF, _INF, deadline, quiescence)
        except _SearchAborted:
            break
        if move is not None:
            best_move = move
        if time.monotonic() >= deadline:
            break
        if score >= MATE_SCORE - 1000:
            break  # forced mate found -- searching deeper can't improve on winning
        depth += 1

    return best_move


def choose_ai_move(state, difficulty, rng=None):
    """The single entry point the CLI/web layer calls."""
    rng = rng or random
    preset = DIFFICULTY_PRESETS[difficulty]

    legal_moves = generate_legal_moves(state)
    if not legal_moves:
        return None

    if preset["mode"] == "random":
        return rng.choice(legal_moves)

    return choose_move_by_search(state, preset["max_depth"], preset["time_budget"], preset["quiescence"])
