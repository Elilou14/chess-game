import assert from "node:assert/strict";
import { test } from "node:test";

import { chooseAiMove, chooseMoveBySearch, evaluate } from "../chess-ai.js";
import { initialState } from "../chess-logic.js";
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

/** Tiny deterministic PRNG (mulberry32) so "facile" tests are reproducible. */
function seededRng(seed) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("evaluate", async (t) => {
  await t.test("starting position is balanced", () => {
    assert.equal(evaluate(initialState()), 0);
  });

  await t.test("material advantage is reflected", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    board[7][3] = { type: "Q", color: "w" };
    assert.ok(evaluate(stateWith(board)) > 800);
  });

  await t.test("black material advantage is negative", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    board[0][3] = { type: "Q", color: "b" };
    assert.ok(evaluate(stateWith(board)) < -800);
  });

  await t.test("central knight scores higher than corner knight", () => {
    const central = emptyBoard();
    central[7][4] = { type: "K", color: "w" };
    central[0][4] = { type: "K", color: "b" };
    central[4][4] = { type: "N", color: "w" };

    const corner = emptyBoard();
    corner[7][4] = { type: "K", color: "w" };
    corner[0][4] = { type: "K", color: "b" };
    corner[7][0] = { type: "N", color: "w" };

    assert.ok(evaluate(stateWith(central)) > evaluate(stateWith(corner)));
  });
});

test("search tactics", async (t) => {
  // White mates in one: Ra1-a8# -- the black king on g8 is boxed in
  // by its own pawns, nothing blocks the a-file/8th rank.
  const mateBoard = emptyBoard();
  mateBoard[7][0] = { type: "R", color: "w" };
  mateBoard[7][4] = { type: "K", color: "w" };
  mateBoard[0][6] = { type: "K", color: "b" };
  mateBoard[1][5] = { type: "P", color: "b" };
  mateBoard[1][6] = { type: "P", color: "b" };
  mateBoard[1][7] = { type: "P", color: "b" };
  const mateInOneState = stateWith(mateBoard);

  const hangingBoard = emptyBoard();
  hangingBoard[7][0] = { type: "R", color: "w" };
  hangingBoard[7][4] = { type: "K", color: "w" };
  hangingBoard[0][0] = { type: "Q", color: "b" };
  hangingBoard[0][7] = { type: "K", color: "b" };
  const hangingQueenState = stateWith(hangingBoard);

  await t.test("moyen finds mate in one", () => {
    const move = chooseAiMove(mateInOneState, "moyen");
    assert.deepEqual([move.from, move.to], [[7, 0], [0, 0]]);
  });

  await t.test("difficile finds mate in one", () => {
    const move = chooseAiMove(mateInOneState, "difficile");
    assert.deepEqual([move.from, move.to], [[7, 0], [0, 0]]);
  });

  await t.test("moyen takes the hanging queen", () => {
    const move = chooseAiMove(hangingQueenState, "moyen");
    assert.deepEqual([move.from, move.to], [[7, 0], [0, 0]]);
  });

  await t.test("difficile takes the hanging queen", () => {
    const move = chooseAiMove(hangingQueenState, "difficile");
    assert.deepEqual([move.from, move.to], [[7, 0], [0, 0]]);
  });

  await t.test("search move is always legal", () => {
    const legalPairs = new Set(generateLegalMoves(hangingQueenState).map((m) => `${m.from}-${m.to}`));
    const move = chooseMoveBySearch(hangingQueenState, 3, 2.0);
    assert.ok(legalPairs.has(`${move.from}-${move.to}`));
  });
});

test("facile difficulty", async (t) => {
  await t.test("returns a legal move", () => {
    const state = initialState();
    const legalPairs = new Set(generateLegalMoves(state).map((m) => `${m.from}-${m.to}`));
    const move = chooseAiMove(state, "facile", seededRng(42));
    assert.ok(legalPairs.has(`${move.from}-${move.to}`));
  });

  await t.test("deterministic with a seeded rng", () => {
    const state = initialState();
    const moveA = chooseAiMove(state, "facile", seededRng(7));
    const moveB = chooseAiMove(state, "facile", seededRng(7));
    assert.deepEqual([moveA.from, moveA.to], [moveB.from, moveB.to]);
  });
});

test("no legal moves", async (t) => {
  await t.test("returns null when no legal moves exist", () => {
    const board = emptyBoard();
    board[7][7] = { type: "K", color: "w" };
    board[6][5] = { type: "P", color: "w" };
    board[6][6] = { type: "P", color: "w" };
    board[6][7] = { type: "P", color: "w" };
    board[7][0] = { type: "R", color: "b" };
    board[0][0] = { type: "K", color: "b" };
    assert.equal(chooseAiMove(stateWith(board), "moyen"), null);
  });
});
