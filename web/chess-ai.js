/**
 * The computer opponent: a static evaluation function and an
 * alpha-beta search on top of it, tuned differently per difficulty
 * level. A direct port of python/chess_ai.py -- see that file for
 * the fuller design notes (the honest scope disclaimer included:
 * this is a hobby-strength engine, not a Stockfish competitor).
 */

import { isInCheck } from "./chess-check.js";
import { applyMove } from "./chess-logic.js";
import { generateLegalMoves } from "./chess-special.js";

export const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

const MATE_SCORE = 100_000;
const INF = Infinity;

// Tomasz Michniewski's "Simplified Evaluation Function" piece-square
// tables -- indexed a8..h8, a7..h7, ... a1..h1 (already in this
// project's row-0-is-rank-8 order for White; Black's score for a
// square is looked up by mirroring the row).
const PST = {
  P: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  N: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  B: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  R: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  Q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  K: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

export const DIFFICULTY_PRESETS = {
  facile: { mode: "random" },
  moyen: { mode: "search", maxDepth: 2, timeBudget: 2.0, quiescence: false },
  difficile: { mode: "search", maxDepth: 4, timeBudget: 3.0, quiescence: true },
  impossible: { mode: "search", maxDepth: 8, timeBudget: 5.0, quiescence: true },
};

class SearchAborted extends Error {}

function pstValue(pieceType, row, col, color) {
  const tableRow = color === "w" ? row : 7 - row;
  return PST[pieceType][tableRow * 8 + col];
}

/** Static material + position score, positive is good for White. */
export function evaluate(state) {
  let score = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = state.board[row][col];
      if (piece === null) continue;
      const value = PIECE_VALUES[piece.type] + pstValue(piece.type, row, col, piece.color);
      score += piece.color === "w" ? value : -value;
    }
  }
  return score;
}

function scoreForMover(state) {
  const score = evaluate(state);
  return state.turn === "w" ? score : -score;
}

/** MVV-LVA: try promising captures first so alpha-beta cuts more. */
function moveOrderKey(move) {
  if (move.captured === null) return 0;
  return PIECE_VALUES[move.captured.type] * 10 - PIECE_VALUES[move.piece.type];
}

function orderedMoves(moves) {
  return [...moves].sort((a, b) => moveOrderKey(b) - moveOrderKey(a));
}

function checkDeadline(deadline) {
  if (Date.now() > deadline) throw new SearchAborted();
}

/**
 * Keep searching captures past the nominal search horizon so the
 * static eval is never taken mid-exchange (the "horizon effect").
 */
function quiescence(state, alpha, beta, deadline, qdepth = 0, maxQdepth = 6) {
  checkDeadline(deadline);

  const standPat = scoreForMover(state);
  if (standPat >= beta) return beta;
  alpha = Math.max(alpha, standPat);
  if (qdepth >= maxQdepth) return standPat;

  const captures = orderedMoves(generateLegalMoves(state).filter((m) => m.captured !== null));
  for (const move of captures) {
    const child = applyMove(state, move);
    const score = -quiescence(child, -beta, -alpha, deadline, qdepth + 1, maxQdepth);
    if (score >= beta) return beta;
    alpha = Math.max(alpha, score);
  }
  return alpha;
}

function negamax(state, depth, alpha, beta, deadline, useQuiescence) {
  checkDeadline(deadline);

  const moves = generateLegalMoves(state);
  if (moves.length === 0) {
    if (isInCheck(state, state.turn)) return [-(MATE_SCORE + depth), null];
    return [0, null];
  }

  if (depth === 0) {
    const score = useQuiescence ? quiescence(state, alpha, beta, deadline) : scoreForMover(state);
    return [score, null];
  }

  let bestScore = -INF;
  let bestMove = moves[0];
  for (const move of orderedMoves(moves)) {
    const child = applyMove(state, move);
    const [childScore] = negamax(child, depth - 1, -beta, -alpha, deadline, useQuiescence);
    const score = -childScore;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }

  return [bestScore, bestMove];
}

/**
 * Iterative deepening: search depth 1, then 2, then 3, ... keeping
 * the best move found by the last *fully completed* depth. If the
 * time budget runs out mid-search, that depth's partial result is
 * discarded and the previous depth's move is used instead.
 */
export function chooseMoveBySearch(state, maxDepth, timeBudget, quiescenceOn = true) {
  const legalMoves = generateLegalMoves(state);
  if (legalMoves.length === 0) return null;

  const deadline = Date.now() + timeBudget * 1000;
  let bestMove = legalMoves[0];
  let depth = 1;
  while (depth <= maxDepth) {
    let score, move;
    try {
      [score, move] = negamax(state, depth, -INF, INF, deadline, quiescenceOn);
    } catch (err) {
      if (err instanceof SearchAborted) break;
      throw err;
    }
    if (move !== null) bestMove = move;
    if (Date.now() >= deadline) break;
    if (score >= MATE_SCORE - 1000) break; // forced mate found
    depth += 1;
  }

  return bestMove;
}

/** The single entry point the CLI/web layer calls. */
export function chooseAiMove(state, difficulty, rng = Math.random) {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const legalMoves = generateLegalMoves(state);
  if (legalMoves.length === 0) return null;

  if (preset.mode === "random") {
    return legalMoves[Math.floor(rng() * legalMoves.length)];
  }

  return chooseMoveBySearch(state, preset.maxDepth, preset.timeBudget, preset.quiescence);
}
