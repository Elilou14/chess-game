import assert from "node:assert/strict";
import { test } from "node:test";

import { applyMove } from "../chess-logic.js";
import {
  generateCastlingPseudoLegalMoves,
  generateEnPassantPseudoLegalMoves,
  generateLegalMoves,
} from "../chess-special.js";

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

test("castling generation", async (t) => {
  function boardWithRooks() {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][0] = { type: "R", color: "w" };
    board[7][7] = { type: "R", color: "w" };
    return board;
  }

  await t.test("both sides available with clear path and rights", () => {
    const state = stateWith(boardWithRooks(), { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    const sides = generateCastlingPseudoLegalMoves(state).map((m) => m.castle).sort();
    assert.deepEqual(sides, ["K", "Q"]);
  });

  await t.test("no castling without rights", () => {
    const state = stateWith(boardWithRooks(), { castling: { wK: false, wQ: false, bK: false, bQ: false } });
    assert.deepEqual(generateCastlingPseudoLegalMoves(state), []);
  });

  await t.test("kingside blocked by piece", () => {
    const board = boardWithRooks();
    board[7][5] = { type: "B", color: "w" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    assert.ok(!generateCastlingPseudoLegalMoves(state).some((m) => m.castle === "K"));
  });

  await t.test("queenside blocked by piece", () => {
    const board = boardWithRooks();
    board[7][1] = { type: "N", color: "w" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    assert.ok(!generateCastlingPseudoLegalMoves(state).some((m) => m.castle === "Q"));
  });

  await t.test("no castling while in check", () => {
    const board = boardWithRooks();
    board[0][4] = { type: "R", color: "b" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    assert.deepEqual(generateCastlingPseudoLegalMoves(state), []);
  });

  await t.test("no castling through attacked square", () => {
    const board = boardWithRooks();
    board[0][5] = { type: "R", color: "b" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    assert.ok(!generateCastlingPseudoLegalMoves(state).some((m) => m.castle === "K"));
  });

  await t.test("no castling into attacked square", () => {
    const board = boardWithRooks();
    board[0][6] = { type: "R", color: "b" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    assert.ok(!generateCastlingPseudoLegalMoves(state).some((m) => m.castle === "K"));
  });

  await t.test("rook attack on b1 does not block queenside", () => {
    const board = boardWithRooks();
    board[0][1] = { type: "R", color: "b" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    assert.ok(generateCastlingPseudoLegalMoves(state).some((m) => m.castle === "Q"));
  });
});

test("castling execution", async (t) => {
  await t.test("kingside castle moves king and rook", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][7] = { type: "R", color: "w" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    const move = generateCastlingPseudoLegalMoves(state)[0];
    const next = applyMove(state, move);
    assert.deepEqual(next.board[7][6], { type: "K", color: "w" });
    assert.deepEqual(next.board[7][5], { type: "R", color: "w" });
    assert.equal(next.board[7][4], null);
    assert.equal(next.board[7][7], null);
  });

  await t.test("queenside castle moves king and rook", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][0] = { type: "R", color: "w" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: false, bQ: false } });
    const move = generateCastlingPseudoLegalMoves(state).find((m) => m.castle === "Q");
    const next = applyMove(state, move);
    assert.deepEqual(next.board[7][2], { type: "K", color: "w" });
    assert.deepEqual(next.board[7][3], { type: "R", color: "w" });
    assert.equal(next.board[7][0], null);
  });

  await t.test("castling revokes both rights", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][7] = { type: "R", color: "w" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: true, bQ: true } });
    const move = generateCastlingPseudoLegalMoves(state)[0];
    const next = applyMove(state, move);
    assert.equal(next.castling.wK, false);
    assert.equal(next.castling.wQ, false);
    assert.equal(next.castling.bK, true);
  });
});

test("en passant generation", async (t) => {
  // White just played e2-e4; the skipped square e3 is (5, 4). A
  // black pawn on d4 (4, 3) can capture en passant, landing on e3.
  await t.test("available immediately after double push", () => {
    const board = emptyBoard();
    board[4][4] = { type: "P", color: "w" };
    board[4][3] = { type: "P", color: "b" };
    const state = stateWith(board, { turn: "b", enPassant: [5, 4] });
    const moves = generateEnPassantPseudoLegalMoves(state);
    assert.equal(moves.length, 1);
    assert.deepEqual(moves[0].from, [4, 3]);
    assert.deepEqual(moves[0].to, [5, 4]);
    assert.equal(moves[0].isEnPassant, true);
  });

  await t.test("no en passant without a target", () => {
    const board = emptyBoard();
    board[4][4] = { type: "P", color: "w" };
    board[4][3] = { type: "P", color: "b" };
    const state = stateWith(board, { turn: "b", enPassant: null });
    assert.deepEqual(generateEnPassantPseudoLegalMoves(state), []);
  });

  await t.test("no en passant without an adjacent pawn", () => {
    const state = stateWith(emptyBoard(), { turn: "b", enPassant: [5, 4] });
    assert.deepEqual(generateEnPassantPseudoLegalMoves(state), []);
  });
});

test("en passant execution", async (t) => {
  await t.test("captures the pawn beside the destination", () => {
    const board = emptyBoard();
    board[4][4] = { type: "P", color: "w" };
    board[4][3] = { type: "P", color: "b" };
    const state = stateWith(board, { turn: "b", enPassant: [5, 4] });
    const move = generateEnPassantPseudoLegalMoves(state)[0];
    const next = applyMove(state, move);
    assert.deepEqual(next.board[5][4], { type: "P", color: "b" });
    assert.equal(next.board[4][4], null);
    assert.equal(next.board[4][3], null);
  });

  await t.test("halfmove clock resets on en passant capture", () => {
    const board = emptyBoard();
    board[4][4] = { type: "P", color: "w" };
    board[4][3] = { type: "P", color: "b" };
    const state = stateWith(board, { turn: "b", enPassant: [5, 4], halfmoveClock: 9 });
    const move = generateEnPassantPseudoLegalMoves(state)[0];
    assert.equal(applyMove(state, move).halfmoveClock, 0);
  });
});

test("generateLegalMoves includes special moves", async (t) => {
  await t.test("includes castling when available", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    board[7][7] = { type: "R", color: "w" };
    board[0][4] = { type: "K", color: "b" };
    const state = stateWith(board, { castling: { wK: true, wQ: false, bK: false, bQ: false } });
    assert.ok(generateLegalMoves(state).some((m) => m.castle === "K"));
  });

  await t.test("includes en passant when available", () => {
    const board = emptyBoard();
    board[4][4] = { type: "P", color: "w" };
    board[4][3] = { type: "P", color: "b" };
    board[0][0] = { type: "K", color: "b" };
    board[7][0] = { type: "K", color: "w" };
    const state = stateWith(board, { turn: "b", enPassant: [5, 4] });
    assert.ok(generateLegalMoves(state).some((m) => m.isEnPassant));
  });

  await t.test("en passant illegal if it exposes own king", () => {
    // White king a5, white pawn b5, black pawn c5 (just double-pushed
    // from c7), black rook h5: capturing en passant would remove
    // both pawns from the rank, exposing the king to the rook.
    const board = emptyBoard();
    board[3][0] = { type: "K", color: "w" };
    board[3][1] = { type: "P", color: "w" };
    board[3][2] = { type: "P", color: "b" };
    board[3][7] = { type: "R", color: "b" };
    board[0][7] = { type: "K", color: "b" };
    const state = stateWith(board, { turn: "w", enPassant: [2, 2] });
    assert.ok(!generateLegalMoves(state).some((m) => m.isEnPassant));
  });
});

test("promotion end to end", async (t) => {
  await t.test("promotion choice appears among legal moves", () => {
    const board = emptyBoard();
    board[1][0] = { type: "P", color: "w" };
    board[7][7] = { type: "K", color: "w" };
    board[0][7] = { type: "K", color: "b" };
    const state = stateWith(board);
    const promotions = generateLegalMoves(state)
      .filter((m) => m.from[0] === 1 && m.from[1] === 0)
      .map((m) => m.promotion)
      .sort();
    assert.deepEqual(promotions, ["B", "N", "Q", "R"]);
  });
});
