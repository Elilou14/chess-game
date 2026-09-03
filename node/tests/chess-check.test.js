import assert from "node:assert/strict";
import { test } from "node:test";

import { generateLegalMoves, isInCheck, isSquareAttacked } from "../chess-check.js";
import { initialState } from "../chess-logic.js";

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

function destinations(moves, from = null) {
  const filtered = from ? moves.filter((m) => m.from[0] === from[0] && m.from[1] === from[1]) : moves;
  return filtered.map((m) => m.to).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

test("isSquareAttacked", async (t) => {
  await t.test("pawn attacks diagonally forward", () => {
    const board = emptyBoard();
    board[4][4] = { type: "P", color: "w" };
    assert.equal(isSquareAttacked(board, 3, 3, "w"), true);
    assert.equal(isSquareAttacked(board, 3, 5, "w"), true);
    assert.equal(isSquareAttacked(board, 3, 4, "w"), false);
  });

  await t.test("black pawn attacks the other way", () => {
    const board = emptyBoard();
    board[3][3] = { type: "P", color: "b" };
    assert.equal(isSquareAttacked(board, 4, 4, "b"), true);
    assert.equal(isSquareAttacked(board, 2, 2, "b"), false);
  });

  await t.test("knight attack", () => {
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "w" };
    assert.equal(isSquareAttacked(board, 2, 3, "w"), true);
    assert.equal(isSquareAttacked(board, 4, 3, "w"), false);
  });

  await t.test("king attacks adjacent squares only", () => {
    const board = emptyBoard();
    board[4][4] = { type: "K", color: "w" };
    assert.equal(isSquareAttacked(board, 3, 4, "w"), true);
    assert.equal(isSquareAttacked(board, 2, 4, "w"), false);
  });

  await t.test("rook attacks along open file", () => {
    const board = emptyBoard();
    board[0][4] = { type: "R", color: "b" };
    assert.equal(isSquareAttacked(board, 7, 4, "b"), true);
  });

  await t.test("rook attack blocked by intervening piece", () => {
    const board = emptyBoard();
    board[0][4] = { type: "R", color: "b" };
    board[4][4] = { type: "P", color: "w" };
    assert.equal(isSquareAttacked(board, 7, 4, "b"), false);
  });

  await t.test("bishop attacks diagonal", () => {
    const board = emptyBoard();
    board[0][0] = { type: "B", color: "b" };
    assert.equal(isSquareAttacked(board, 7, 7, "b"), true);
  });

  await t.test("queen attacks both ways", () => {
    const board = emptyBoard();
    board[4][4] = { type: "Q", color: "w" };
    assert.equal(isSquareAttacked(board, 4, 0, "w"), true);
    assert.equal(isSquareAttacked(board, 0, 0, "w"), true);
  });

  await t.test("empty board attacks nothing", () => {
    const board = emptyBoard();
    assert.equal(isSquareAttacked(board, 4, 4, "w"), false);
    assert.equal(isSquareAttacked(board, 4, 4, "b"), false);
  });
});

test("isInCheck", async (t) => {
  await t.test("king in check from rook", () => {
    const board = emptyBoard();
    board[4][4] = { type: "K", color: "w" };
    board[4][0] = { type: "R", color: "b" };
    assert.equal(isInCheck(stateWith(board), "w"), true);
  });

  await t.test("king not in check", () => {
    const board = emptyBoard();
    board[4][4] = { type: "K", color: "w" };
    board[0][0] = { type: "R", color: "b" };
    assert.equal(isInCheck(stateWith(board), "w"), false);
  });

  await t.test("initial position no one in check", () => {
    const state = initialState();
    assert.equal(isInCheck(state, "w"), false);
    assert.equal(isInCheck(state, "b"), false);
  });
});

test("generateLegalMoves", async (t) => {
  await t.test("initial position has twenty legal moves", () => {
    assert.equal(generateLegalMoves(initialState()).length, 20);
  });

  await t.test("pinned piece cannot move off the pin line", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[6][4] = { type: "B", color: "w" };
    board[0][4] = { type: "R", color: "b" };
    const moves = generateLegalMoves(stateWith(board));
    assert.deepEqual(destinations(moves, [6, 4]), []);
  });

  await t.test("king cannot move into check", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][3] = { type: "R", color: "b" };
    const moves = generateLegalMoves(stateWith(board));
    const kingDest = destinations(moves, [7, 4]);
    assert.ok(!kingDest.some(([r, c]) => r === 7 && c === 3));
    assert.ok(kingDest.some(([r, c]) => r === 7 && c === 5));
  });

  await t.test("check can be resolved by capturing the checker", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "R", color: "b" };
    board[0][0] = { type: "R", color: "w" };
    const state = stateWith(board);
    assert.equal(isInCheck(state, "w"), true);
    const moves = generateLegalMoves(state);
    const capture = moves.filter((m) => m.from[0] === 0 && m.from[1] === 0 && m.to[0] === 0 && m.to[1] === 4);
    assert.equal(capture.length, 1);
  });

  await t.test("check can be resolved by blocking", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "R", color: "b" };
    board[4][7] = { type: "R", color: "w" };
    const moves = generateLegalMoves(stateWith(board));
    const blocking = moves.filter((m) => m.from[0] === 4 && m.from[1] === 7 && m.to[0] === 4 && m.to[1] === 4);
    assert.equal(blocking.length, 1);
  });

  await t.test("moves that don't address check are illegal", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "R", color: "b" };
    board[7][0] = { type: "R", color: "w" };
    const moves = generateLegalMoves(stateWith(board));
    assert.deepEqual(destinations(moves, [7, 0]), []);
  });

  await t.test("checkmate position has no legal moves", () => {
    const board = emptyBoard();
    board[7][7] = { type: "K", color: "w" };
    board[6][5] = { type: "P", color: "w" };
    board[6][6] = { type: "P", color: "w" };
    board[6][7] = { type: "P", color: "w" };
    board[7][0] = { type: "R", color: "b" };
    board[0][0] = { type: "K", color: "b" };
    const state = stateWith(board);
    assert.equal(isInCheck(state, "w"), true);
    assert.deepEqual(generateLegalMoves(state), []);
  });
});
