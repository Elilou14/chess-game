/**
 * Check detection and legal-move filtering, built on top of
 * chess-logic's pseudo-legal move generation and applyMove. Still
 * pure. A direct port of python/chess_check.py.
 */

import { applyMove, generatePseudoLegalMoves, inBounds, oppositeColor } from "./chess-logic.js";

const KNIGHT_DELTAS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const DIAGONAL_DELTAS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHOGONAL_DELTAS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const KING_DELTAS = [...DIAGONAL_DELTAS, ...ORTHOGONAL_DELTAS];

export function findKing(board, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece !== null && piece.type === "K" && piece.color === color) {
        return [row, col];
      }
    }
  }
  return null;
}

function pawnAttacksSquare(board, row, col, byColor) {
  const pawnRow = byColor === "w" ? row + 1 : row - 1;
  if (!inBounds(pawnRow, 0)) return false;
  for (const pawnCol of [col - 1, col + 1]) {
    if (inBounds(pawnRow, pawnCol)) {
      const piece = board[pawnRow][pawnCol];
      if (piece !== null && piece.type === "P" && piece.color === byColor) return true;
    }
  }
  return false;
}

function stepAttacksSquare(board, row, col, byColor, deltas, pieceTypes) {
  for (const [dRow, dCol] of deltas) {
    const r = row + dRow;
    const c = col + dCol;
    if (!inBounds(r, c)) continue;
    const piece = board[r][c];
    if (piece !== null && piece.color === byColor && pieceTypes.has(piece.type)) return true;
  }
  return false;
}

function slidingAttacksSquare(board, row, col, byColor, deltas, pieceTypes) {
  for (const [dRow, dCol] of deltas) {
    let r = row + dRow;
    let c = col + dCol;
    while (inBounds(r, c)) {
      const piece = board[r][c];
      if (piece !== null) {
        if (piece.color === byColor && pieceTypes.has(piece.type)) return true;
        break;
      }
      r += dRow;
      c += dCol;
    }
  }
  return false;
}

/** Is (row, col) attacked by any piece of `byColor` on this board? */
export function isSquareAttacked(board, row, col, byColor) {
  if (pawnAttacksSquare(board, row, col, byColor)) return true;
  if (stepAttacksSquare(board, row, col, byColor, KNIGHT_DELTAS, new Set(["N"]))) return true;
  if (stepAttacksSquare(board, row, col, byColor, KING_DELTAS, new Set(["K"]))) return true;
  if (slidingAttacksSquare(board, row, col, byColor, DIAGONAL_DELTAS, new Set(["B", "Q"]))) return true;
  if (slidingAttacksSquare(board, row, col, byColor, ORTHOGONAL_DELTAS, new Set(["R", "Q"]))) return true;
  return false;
}

export function isInCheck(state, color) {
  const kingSquare = findKing(state.board, color);
  if (kingSquare === null) return false;
  return isSquareAttacked(state.board, kingSquare[0], kingSquare[1], oppositeColor(color));
}

/**
 * Filter pseudo-legal moves down to those that don't leave the
 * mover's own king in check. Defaults to ordinary-piece pseudo-legal
 * moves; chess-special.js passes in a list that also includes
 * castling and en passant so those get the same safety filter.
 */
export function generateLegalMoves(state, pseudoLegalMoves = null) {
  const mover = state.turn;
  const moves = pseudoLegalMoves ?? generatePseudoLegalMoves(state);
  const legal = [];
  for (const move of moves) {
    const resultingState = applyMove(state, move);
    if (!isInCheck(resultingState, mover)) {
      legal.push(move);
    }
  }
  return legal;
}
