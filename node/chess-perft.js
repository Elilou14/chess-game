/**
 * Perft (performance test): count the leaf nodes of the legal-move
 * tree at a given depth -- the standard way to validate a chess move
 * generator. A direct port of python/chess_perft.py.
 */

import { applyMove } from "./chess-logic.js";
import { generateLegalMoves } from "./chess-special.js";

export function perft(state, depth) {
  if (depth === 0) return 1;
  let total = 0;
  for (const move of generateLegalMoves(state)) {
    total += perft(applyMove(state, move), depth - 1);
  }
  return total;
}
