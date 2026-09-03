"""
Game-end detection: checkmate, stalemate, and draw rules (50-move,
threefold repetition, insufficient material). Pure -- status is
purely a function of the state (and, for repetition, a history of
prior position keys the caller maintains).
"""

from chess_check import is_in_check
from chess_special import generate_legal_moves


def position_key(state):
    """
    A hashable snapshot of everything that makes two positions "the
    same" for repetition purposes: piece placement, side to move,
    castling rights, and the en passant target. Move counters don't
    count -- FIDE's repetition rule ignores them.
    """
    board_key = tuple(
        tuple((piece["type"], piece["color"]) if piece else None for piece in row)
        for row in state["board"]
    )
    castling_key = tuple(sorted(state["castling"].items()))
    return (board_key, state["turn"], castling_key, state["en_passant"])


def _has_insufficient_material(board):
    """
    Only the simplest, unambiguous cases: a lone king, or a king plus
    a single minor piece, against a lone king. Anything else (two
    minors, a rook, a queen, pawns still on board) can still --
    however unlikely -- deliver checkmate, so it's not auto-drawn.
    """
    pieces = [piece for row in board for piece in row if piece is not None]
    non_king = [piece for piece in pieces if piece["type"] != "K"]

    if len(non_king) == 0:
        return True
    if len(non_king) == 1 and non_king[0]["type"] in ("B", "N"):
        return True
    return False


def get_game_status(state, position_history=None):
    """
    Returns one of: "ongoing", "checkmate", "stalemate",
    "draw_50_move", "draw_repetition", "draw_insufficient_material".

    `position_history`, when given, is the list of position_key(...)
    values for every position reached so far in the game, INCLUDING
    the current one -- so counting the current key in that list IS
    the repetition count.
    """
    legal_moves = generate_legal_moves(state)
    if not legal_moves:
        return "checkmate" if is_in_check(state, state["turn"]) else "stalemate"

    if state["halfmove_clock"] >= 100:
        return "draw_50_move"

    if position_history is not None:
        if position_history.count(position_key(state)) >= 3:
            return "draw_repetition"

    if _has_insufficient_material(state["board"]):
        return "draw_insufficient_material"

    return "ongoing"
