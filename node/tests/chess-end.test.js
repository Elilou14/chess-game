import assert from "node:assert/strict";
import { test } from "node:test";

import { getGameStatus, positionKey } from "../chess-end.js";
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

test("game status", async (t) => {
  await t.test("starting position is ongoing", () => {
    assert.equal(getGameStatus(initialState()), "ongoing");
  });

  await t.test("back rank checkmate", () => {
    const board = emptyBoard();
    board[7][7] = { type: "K", color: "w" };
    board[6][5] = { type: "P", color: "w" };
    board[6][6] = { type: "P", color: "w" };
    board[6][7] = { type: "P", color: "w" };
    board[7][0] = { type: "R", color: "b" };
    board[0][0] = { type: "K", color: "b" };
    assert.equal(getGameStatus(stateWith(board)), "checkmate");
  });

  await t.test("classic queen+king stalemate", () => {
    const board = emptyBoard();
    board[0][7] = { type: "K", color: "b" }; // h8
    board[1][5] = { type: "K", color: "w" }; // f7
    board[2][6] = { type: "Q", color: "w" }; // g6
    assert.equal(getGameStatus(stateWith(board, { turn: "b" })), "stalemate");
  });

  await t.test("fifty move rule", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    board[7][0] = { type: "R", color: "w" };
    assert.equal(getGameStatus(stateWith(board, { halfmoveClock: 100 })), "draw_50_move");
  });

  await t.test("below fifty move threshold is not a draw on that basis", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    board[7][0] = { type: "R", color: "w" };
    assert.equal(getGameStatus(stateWith(board, { halfmoveClock: 99 })), "ongoing");
  });

  await t.test("checkmate takes precedence over fifty move rule", () => {
    const board = emptyBoard();
    board[7][7] = { type: "K", color: "w" };
    board[6][5] = { type: "P", color: "w" };
    board[6][6] = { type: "P", color: "w" };
    board[6][7] = { type: "P", color: "w" };
    board[7][0] = { type: "R", color: "b" };
    board[0][0] = { type: "K", color: "b" };
    assert.equal(getGameStatus(stateWith(board, { halfmoveClock: 100 })), "checkmate");
  });

  await t.test("threefold repetition", () => {
    const state = initialState();
    const key = positionKey(state);
    assert.equal(getGameStatus(state, [key, key, key]), "draw_repetition");
  });

  await t.test("twofold repetition is not a draw", () => {
    const state = initialState();
    const key = positionKey(state);
    assert.equal(getGameStatus(state, [key, key]), "ongoing");
  });

  await t.test("king vs king is insufficient material", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    assert.equal(getGameStatus(stateWith(board)), "draw_insufficient_material");
  });

  await t.test("king and knight vs king is insufficient", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][1] = { type: "N", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    assert.equal(getGameStatus(stateWith(board)), "draw_insufficient_material");
  });

  await t.test("king and rook vs king is not insufficient", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][0] = { type: "R", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    assert.equal(getGameStatus(stateWith(board)), "ongoing");
  });
});

test("positionKey", async (t) => {
  await t.test("identical positions produce the same key", () => {
    assert.equal(positionKey(initialState()), positionKey(initialState()));
  });

  await t.test("different side to move changes the key", () => {
    const state = initialState();
    assert.notEqual(positionKey(state), positionKey({ ...state, turn: "b" }));
  });

  await t.test("different castling rights change the key", () => {
    const state = initialState();
    const other = { ...state, castling: { wK: false, wQ: true, bK: true, bQ: true } };
    assert.notEqual(positionKey(state), positionKey(other));
  });

  await t.test("move counters do not affect the key", () => {
    const state = initialState();
    const other = { ...state, halfmoveClock: 17, fullmoveNumber: 9 };
    assert.equal(positionKey(state), positionKey(other));
  });
});
