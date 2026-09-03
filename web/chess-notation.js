/**
 * Standard Algebraic Notation (SAN) formatting -- "Nf3", "exd5",
 * "O-O", "e8=Q#". Pure: takes the move plus the legal-move list from
 * before it was played (for disambiguation) and the resulting state
 * (for the check/mate suffix), returns a string.
 */

import { isInCheck } from "./chess-check.js";
import { rcToSquare } from "./chess-logic.js";
import { generateLegalMoves } from "./chess-special.js";

function fileLetter(col) {
  return String.fromCharCode("a".charCodeAt(0) + col);
}

function rankDigit(row) {
  return String(8 - row);
}

/**
 * When another piece of the same type could also reach the
 * destination, SAN disambiguates with the file, or the rank if the
 * file also clashes, or the full origin square if both do.
 */
function disambiguation(move, legalMovesBeforeMove) {
  const others = legalMovesBeforeMove.filter(
    (m) =>
      m.piece.type === move.piece.type &&
      m.piece.color === move.piece.color &&
      m.to[0] === move.to[0] &&
      m.to[1] === move.to[1] &&
      !(m.from[0] === move.from[0] && m.from[1] === move.from[1])
  );
  if (others.length === 0) return "";

  const sameFile = others.some((m) => m.from[1] === move.from[1]);
  const sameRank = others.some((m) => m.from[0] === move.from[0]);

  if (!sameFile) return fileLetter(move.from[1]);
  if (!sameRank) return rankDigit(move.from[0]);
  return rcToSquare(...move.from);
}

function checkSuffix(stateAfterMove) {
  if (!isInCheck(stateAfterMove, stateAfterMove.turn)) return "";
  return generateLegalMoves(stateAfterMove).length === 0 ? "#" : "+";
}

export function formatSan(move, legalMovesBeforeMove, stateAfterMove) {
  if (move.castle === "K") return "O-O" + checkSuffix(stateAfterMove);
  if (move.castle === "Q") return "O-O-O" + checkSuffix(stateAfterMove);

  const destination = rcToSquare(...move.to);
  const isCapture = move.captured !== null || move.isEnPassant;

  let text;
  if (move.piece.type === "P") {
    text = isCapture ? `${fileLetter(move.from[1])}x${destination}` : destination;
    if (move.promotion) text += `=${move.promotion}`;
  } else {
    text = `${move.piece.type}${disambiguation(move, legalMovesBeforeMove)}${isCapture ? "x" : ""}${destination}`;
  }

  return text + checkSuffix(stateAfterMove);
}
