/**
 * Game-end detection: checkmate, stalemate, and draw rules (50-move,
 * threefold repetition, insufficient material). A direct port of
 * python/chess_end.py.
 */

import { isInCheck } from "./chess-check.js";
import { generateLegalMoves } from "./chess-special.js";

/**
 * A JSON-stringifiable snapshot of everything that makes two
 * positions "the same" for repetition purposes: piece placement,
 * side to move, castling rights, and the en passant target. Move
 * counters don't count -- FIDE's repetition rule ignores them.
 */
export function positionKey(state) {
  const boardKey = state.board.map((row) => row.map((piece) => (piece ? [piece.type, piece.color] : null)));
  const castlingKey = ["wK", "wQ", "bK", "bQ"].map((k) => state.castling[k]);
  return JSON.stringify([boardKey, state.turn, castlingKey, state.enPassant]);
}

/**
 * Only the simplest, unambiguous cases: a lone king, or a king plus a
 * single minor piece, against a lone king.
 */
function hasInsufficientMaterial(board) {
  const pieces = board.flat().filter((piece) => piece !== null);
  const nonKing = pieces.filter((piece) => piece.type !== "K");

  if (nonKing.length === 0) return true;
  if (nonKing.length === 1 && (nonKing[0].type === "B" || nonKing[0].type === "N")) return true;
  return false;
}

/**
 * Returns one of: "ongoing", "checkmate", "stalemate",
 * "draw_50_move", "draw_repetition", "draw_insufficient_material".
 *
 * `positionHistory`, when given, is the list of positionKey(...)
 * values for every position reached so far in the game, INCLUDING
 * the current one -- so counting the current key in that list IS the
 * repetition count.
 */
export function getGameStatus(state, positionHistory = null) {
  const legalMoves = generateLegalMoves(state);
  if (legalMoves.length === 0) {
    return isInCheck(state, state.turn) ? "checkmate" : "stalemate";
  }

  if (state.halfmoveClock >= 100) return "draw_50_move";

  if (positionHistory !== null) {
    const currentKey = positionKey(state);
    const count = positionHistory.filter((key) => key === currentKey).length;
    if (count >= 3) return "draw_repetition";
  }

  if (hasInsufficientMaterial(state.board)) return "draw_insufficient_material";

  return "ongoing";
}
