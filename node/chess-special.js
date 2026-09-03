/**
 * Castling and en passant *generation*, plus the complete legal-move
 * generator. A direct port of python/chess_special.py.
 */

import { generateLegalMoves as filterForCheck, isInCheck, isSquareAttacked } from "./chess-check.js";
import { generatePseudoLegalMoves, inBounds, makeMove, oppositeColor } from "./chess-logic.js";

function castleMove(homeRow, color, side) {
  const king = { type: "K", color };
  const toCol = side === "K" ? 6 : 2;
  return makeMove([homeRow, 4], [homeRow, toCol], king, { castle: side });
}

/**
 * Castling is available when: the right hasn't been revoked, the
 * squares between king and rook are empty, the king isn't currently
 * in check, and the king's start/transit/landing squares aren't
 * attacked (it can never move through or into check).
 */
export function generateCastlingPseudoLegalMoves(state) {
  const moves = [];
  const color = state.turn;
  const board = state.board;
  const homeRow = color === "w" ? 7 : 0;
  const enemy = oppositeColor(color);

  const king = board[homeRow][4];
  if (king === null || king.type !== "K" || king.color !== color) return moves;
  if (isInCheck(state, color)) return moves;

  if (state.castling[`${color}K`]) {
    const rook = board[homeRow][7];
    const pathClear = board[homeRow][5] === null && board[homeRow][6] === null;
    if (pathClear && rook !== null && rook.type === "R" && rook.color === color) {
      if (!isSquareAttacked(board, homeRow, 5, enemy) && !isSquareAttacked(board, homeRow, 6, enemy)) {
        moves.push(castleMove(homeRow, color, "K"));
      }
    }
  }

  if (state.castling[`${color}Q`]) {
    const rook = board[homeRow][0];
    const pathClear = board[homeRow][1] === null && board[homeRow][2] === null && board[homeRow][3] === null;
    if (pathClear && rook !== null && rook.type === "R" && rook.color === color) {
      if (!isSquareAttacked(board, homeRow, 3, enemy) && !isSquareAttacked(board, homeRow, 2, enemy)) {
        moves.push(castleMove(homeRow, color, "Q"));
      }
    }
  }

  return moves;
}

/**
 * Available only right after the opponent's pawn double-pushed
 * (state.enPassant names the skipped-over square), and only for a
 * pawn of the side to move sitting beside it.
 */
export function generateEnPassantPseudoLegalMoves(state) {
  const moves = [];
  const target = state.enPassant;
  if (target === null) return moves;

  const [targetRow, targetCol] = target;
  const color = state.turn;
  const direction = color === "w" ? -1 : 1;
  const capturingRow = targetRow - direction;
  const board = state.board;

  for (const dCol of [-1, 1]) {
    const capturingCol = targetCol + dCol;
    if (!inBounds(capturingRow, capturingCol)) continue;
    const piece = board[capturingRow][capturingCol];
    if (piece !== null && piece.type === "P" && piece.color === color) {
      const capturedPawn = board[capturingRow][targetCol];
      moves.push(
        makeMove([capturingRow, capturingCol], [targetRow, targetCol], piece, {
          captured: capturedPawn,
          isEnPassant: true,
        })
      );
    }
  }

  return moves;
}

export function generateAllPseudoLegalMoves(state) {
  return [
    ...generatePseudoLegalMoves(state),
    ...generateCastlingPseudoLegalMoves(state),
    ...generateEnPassantPseudoLegalMoves(state),
  ];
}

/** The complete legal-move generator: every rule, king-safety filtered. */
export function generateLegalMoves(state) {
  return filterForCheck(state, generateAllPseudoLegalMoves(state));
}
