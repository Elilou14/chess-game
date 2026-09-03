import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSan } from "../chess-notation.js";
import { applyMove } from "../chess-logic.js";
import { generateLegalMoves } from "../chess-special.js";

function emptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function stateWith(board, overrides = {}) {
  return {
    board,
    turn: "w",
    castling: { wK: false, wQ: false, bK: false, bQ: false },
    enPassant: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    ...overrides,
  };
}

function sanFor(state, predicate) {
  const legalMoves = generateLegalMoves(state);
  const move = legalMoves.find(predicate);
  const after = applyMove(state, move);
  return formatSan(move, legalMoves, after);
}

test("formatSan", async (t) => {
  await t.test("simple pawn push", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    const san = sanFor(stateWith(board), (m) => m.to[0] === 4 && m.to[1] === 4);
    assert.equal(san, "e4");
  });

  await t.test("pawn capture", () => {
    const board = emptyBoard();
    board[4][4] = { type: "P", color: "w" };
    board[3][3] = { type: "N", color: "b" };
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    const san = sanFor(stateWith(board), (m) => m.captured !== null);
    assert.equal(san, "exd5");
  });

  await t.test("piece move", () => {
    const board = emptyBoard();
    board[7][6] = { type: "N", color: "w" };
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    const san = sanFor(stateWith(board), (m) => m.to[0] === 5 && m.to[1] === 5);
    assert.equal(san, "Nf3");
  });

  await t.test("piece capture", () => {
    // Also lands the knight a check on e8 -- that's covered by its
    // own dedicated test below, so this one just accepts the "+".
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "w" };
    board[2][3] = { type: "P", color: "b" };
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    const san = sanFor(stateWith(board), (m) => m.captured !== null);
    assert.equal(san, "Nxd6+");
  });

  await t.test("disambiguates by file when ranks match", () => {
    const board = emptyBoard();
    board[5][2] = { type: "N", color: "w" }; // c3
    board[5][6] = { type: "N", color: "w" }; // g3 -- also reaches e4
    board[7][0] = { type: "K", color: "w" };
    board[0][7] = { type: "K", color: "b" };
    const state = stateWith(board);
    const san = sanFor(state, (m) => m.from[0] === 5 && m.from[1] === 2 && m.to[0] === 4 && m.to[1] === 4);
    assert.equal(san, "Nce4");
  });

  await t.test("disambiguates by rank when files match", () => {
    const board = emptyBoard();
    board[0][3] = { type: "R", color: "w" }; // d8
    board[6][3] = { type: "R", color: "w" }; // d2 -- also reaches d5
    board[7][0] = { type: "K", color: "w" };
    board[4][7] = { type: "K", color: "b" }; // h4, off both rooks' lines
    const state = stateWith(board);
    const san = sanFor(state, (m) => m.from[0] === 6 && m.from[1] === 3 && m.to[0] === 3 && m.to[1] === 3);
    assert.equal(san, "R2d5");
  });

  await t.test("kingside castle", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][7] = { type: "R", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    const state = stateWith(board, { castling: { wK: true, wQ: false, bK: false, bQ: false } });
    const san = sanFor(state, (m) => m.castle === "K");
    assert.equal(san, "O-O");
  });

  await t.test("queenside castle", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][0] = { type: "R", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    const state = stateWith(board, { castling: { wK: false, wQ: true, bK: false, bQ: false } });
    const san = sanFor(state, (m) => m.castle === "Q");
    assert.equal(san, "O-O-O");
  });

  await t.test("promotion", () => {
    const board = emptyBoard();
    board[1][0] = { type: "P", color: "w" };
    board[7][7] = { type: "K", color: "w" };
    board[4][7] = { type: "K", color: "b" }; // h4, off a8's rank/file/diagonal
    const state = stateWith(board);
    const san = sanFor(state, (m) => m.promotion === "Q");
    assert.equal(san, "a8=Q");
  });

  await t.test("check suffix", () => {
    // Ra1-a8+: checks along the 8th rank, but the king can still flee.
    const board = emptyBoard();
    board[7][0] = { type: "R", color: "w" };
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    const state = stateWith(board);
    const san = sanFor(state, (m) => m.to[0] === 0 && m.to[1] === 0);
    assert.equal(san, "Ra8+");
  });

  await t.test("checkmate suffix", () => {
    // Back-rank mate: Ra1-a8#.
    const board = emptyBoard();
    board[7][0] = { type: "R", color: "w" };
    board[7][4] = { type: "K", color: "w" };
    board[0][6] = { type: "K", color: "b" };
    board[1][5] = { type: "P", color: "b" };
    board[1][6] = { type: "P", color: "b" };
    board[1][7] = { type: "P", color: "b" };
    const state = stateWith(board);
    const san = sanFor(state, (m) => m.to[0] === 0 && m.to[1] === 0);
    assert.equal(san, "Ra8#");
  });
});
