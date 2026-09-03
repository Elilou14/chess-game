import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyMove,
  generatePseudoLegalMoves,
  initialState,
  loadFen,
  rcToSquare,
  squareToRc,
} from "../chess-logic.js";

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
  return filtered
    .map((m) => m.to)
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

test("square notation", async (t) => {
  await t.test("squareToRc", () => {
    assert.deepEqual(squareToRc("a8"), [0, 0]);
    assert.deepEqual(squareToRc("h1"), [7, 7]);
    assert.deepEqual(squareToRc("e2"), [6, 4]);
  });

  await t.test("rcToSquare", () => {
    assert.equal(rcToSquare(0, 0), "a8");
    assert.equal(rcToSquare(7, 7), "h1");
    assert.equal(rcToSquare(6, 4), "e2");
  });

  await t.test("round trip", () => {
    for (const square of ["a1", "h8", "d4", "e2", "b7"]) {
      assert.equal(rcToSquare(...squareToRc(square)), square);
    }
  });
});

test("initialState", async (t) => {
  await t.test("white back rank and pawns", () => {
    const { board } = initialState();
    assert.deepEqual(board[7][0], { type: "R", color: "w" });
    assert.deepEqual(board[7][4], { type: "K", color: "w" });
    for (let col = 0; col < 8; col++) assert.deepEqual(board[6][col], { type: "P", color: "w" });
  });

  await t.test("black back rank and pawns", () => {
    const { board } = initialState();
    assert.deepEqual(board[0][0], { type: "R", color: "b" });
    assert.deepEqual(board[0][4], { type: "K", color: "b" });
    for (let col = 0; col < 8; col++) assert.deepEqual(board[1][col], { type: "P", color: "b" });
  });

  await t.test("middle ranks empty", () => {
    const { board } = initialState();
    for (let row = 2; row < 6; row++) assert.ok(board[row].every((cell) => cell === null));
  });

  await t.test("starting metadata", () => {
    const state = initialState();
    assert.equal(state.turn, "w");
    assert.deepEqual(state.castling, { wK: true, wQ: true, bK: true, bQ: true });
    assert.equal(state.enPassant, null);
    assert.equal(state.halfmoveClock, 0);
    assert.equal(state.fullmoveNumber, 1);
  });

  await t.test("initial position has 20 pseudo-legal moves", () => {
    assert.equal(generatePseudoLegalMoves(initialState()).length, 20);
  });
});

test("pawn moves", async (t) => {
  await t.test("single and double push from start", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    assert.deepEqual(destinations(moves), [[4, 4], [5, 4]]);
  });

  await t.test("no double push after moving", () => {
    const board = emptyBoard();
    board[5][4] = { type: "P", color: "w" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    assert.deepEqual(destinations(moves), [[4, 4]]);
  });

  await t.test("blocked pawn cannot push", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    board[5][4] = { type: "N", color: "b" };
    assert.deepEqual(destinations(generatePseudoLegalMoves(stateWith(board))), []);
  });

  await t.test("double push blocked by piece on second square", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    board[4][4] = { type: "N", color: "b" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    assert.deepEqual(destinations(moves), [[5, 4]]);
  });

  await t.test("diagonal capture", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    board[5][3] = { type: "N", color: "b" };
    board[5][5] = { type: "N", color: "b" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    assert.deepEqual(destinations(moves, [6, 4]), [[4, 4], [5, 3], [5, 4], [5, 5]]);
  });

  await t.test("cannot capture own piece diagonally", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    board[5][3] = { type: "N", color: "w" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    assert.deepEqual(destinations(moves, [6, 4]), [[4, 4], [5, 4]]);
  });

  await t.test("cannot push forward onto enemy", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    board[5][4] = { type: "N", color: "b" };
    assert.deepEqual(generatePseudoLegalMoves(stateWith(board)), []);
  });

  await t.test("promotion generates four moves", () => {
    const board = emptyBoard();
    board[1][0] = { type: "P", color: "w" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    assert.deepEqual(moves.map((m) => m.promotion).sort(), ["B", "N", "Q", "R"]);
    assert.ok(moves.every((m) => m.to[0] === 0 && m.to[1] === 0));
  });

  await t.test("black pawn moves downward", () => {
    const board = emptyBoard();
    board[1][4] = { type: "P", color: "b" };
    const moves = generatePseudoLegalMoves(stateWith(board, { turn: "b" }));
    assert.deepEqual(destinations(moves), [[2, 4], [3, 4]]);
  });
});

test("knight moves", async (t) => {
  await t.test("center knight has eight moves", () => {
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "w" };
    assert.equal(generatePseudoLegalMoves(stateWith(board)).length, 8);
  });

  await t.test("corner knight has two moves", () => {
    const board = emptyBoard();
    board[0][0] = { type: "N", color: "w" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    assert.deepEqual(destinations(moves).sort(), [[1, 2], [2, 1]].sort());
  });

  await t.test("blocked by own piece", () => {
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "w" };
    board[2][3] = { type: "P", color: "w" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    assert.equal(destinations(moves, [4, 4]).length, 7);
  });

  await t.test("captures enemy", () => {
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "w" };
    board[2][3] = { type: "P", color: "b" };
    const moves = generatePseudoLegalMoves(stateWith(board));
    const capture = moves.find((m) => m.to[0] === 2 && m.to[1] === 3);
    assert.notEqual(capture.captured, null);
  });
});

test("sliding piece moves", async (t) => {
  await t.test("rook on empty board has fourteen moves", () => {
    const board = emptyBoard();
    board[4][4] = { type: "R", color: "w" };
    assert.equal(generatePseudoLegalMoves(stateWith(board)).length, 14);
  });

  await t.test("bishop on empty board has thirteen moves", () => {
    const board = emptyBoard();
    board[4][4] = { type: "B", color: "w" };
    assert.equal(generatePseudoLegalMoves(stateWith(board)).length, 13);
  });

  await t.test("queen on empty board has twenty-seven moves", () => {
    const board = emptyBoard();
    board[4][4] = { type: "Q", color: "w" };
    assert.equal(generatePseudoLegalMoves(stateWith(board)).length, 27);
  });

  await t.test("rook stops before own piece", () => {
    const board = emptyBoard();
    board[4][4] = { type: "R", color: "w" };
    board[4][6] = { type: "P", color: "w" };
    const dest = destinations(generatePseudoLegalMoves(stateWith(board)));
    assert.ok(dest.some(([r, c]) => r === 4 && c === 5));
    assert.ok(!dest.some(([r, c]) => r === 4 && c === 6));
    assert.ok(!dest.some(([r, c]) => r === 4 && c === 7));
  });

  await t.test("rook captures and stops on enemy", () => {
    const board = emptyBoard();
    board[4][4] = { type: "R", color: "w" };
    board[4][6] = { type: "P", color: "b" };
    const dest = destinations(generatePseudoLegalMoves(stateWith(board)));
    assert.ok(dest.some(([r, c]) => r === 4 && c === 6));
    assert.ok(!dest.some(([r, c]) => r === 4 && c === 7));
  });
});

test("king moves", async (t) => {
  await t.test("center king has eight moves", () => {
    const board = emptyBoard();
    board[4][4] = { type: "K", color: "w" };
    assert.equal(generatePseudoLegalMoves(stateWith(board)).length, 8);
  });

  await t.test("corner king has three moves", () => {
    const board = emptyBoard();
    board[0][0] = { type: "K", color: "w" };
    assert.equal(generatePseudoLegalMoves(stateWith(board)).length, 3);
  });
});

test("applyMove", async (t) => {
  await t.test("moves piece and clears origin", () => {
    const state = initialState();
    const move = generatePseudoLegalMoves(state).find((m) => m.from[0] === 6 && m.from[1] === 4 && m.to[0] === 4 && m.to[1] === 4);
    const next = applyMove(state, move);
    assert.equal(next.board[6][4], null);
    assert.deepEqual(next.board[4][4], { type: "P", color: "w" });
  });

  await t.test("does not mutate the original state", () => {
    const state = initialState();
    const move = generatePseudoLegalMoves(state).find((m) => m.from[0] === 6 && m.from[1] === 4 && m.to[0] === 4 && m.to[1] === 4);
    applyMove(state, move);
    assert.deepEqual(state.board[6][4], { type: "P", color: "w" });
    assert.equal(state.board[4][4], null);
  });

  await t.test("turn flips", () => {
    const state = initialState();
    const next = applyMove(state, generatePseudoLegalMoves(state)[0]);
    assert.equal(next.turn, "b");
  });

  await t.test("halfmove clock resets on pawn move", () => {
    const state = { ...initialState(), halfmoveClock: 5 };
    const pawnMove = generatePseudoLegalMoves(state).find((m) => m.piece.type === "P");
    assert.equal(applyMove(state, pawnMove).halfmoveClock, 0);
  });

  await t.test("halfmove clock increments on non-pawn non-capture", () => {
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "w" };
    board[0][0] = { type: "K", color: "b" };
    const state = stateWith(board, { halfmoveClock: 3 });
    const move = generatePseudoLegalMoves(state)[0];
    assert.equal(applyMove(state, move).halfmoveClock, 4);
  });

  await t.test("halfmove clock resets on capture", () => {
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "w" };
    board[2][3] = { type: "P", color: "b" };
    const state = stateWith(board, { halfmoveClock: 7 });
    const capture = generatePseudoLegalMoves(state).find((m) => m.captured !== null);
    assert.equal(applyMove(state, capture).halfmoveClock, 0);
  });

  await t.test("fullmove number increments after Black moves", () => {
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "b" };
    const state = stateWith(board, { turn: "b", fullmoveNumber: 3 });
    const move = generatePseudoLegalMoves(state)[0];
    assert.equal(applyMove(state, move).fullmoveNumber, 4);
  });

  await t.test("fullmove number unchanged after White moves", () => {
    const board = emptyBoard();
    board[4][4] = { type: "N", color: "w" };
    const state = stateWith(board, { fullmoveNumber: 3 });
    const move = generatePseudoLegalMoves(state)[0];
    assert.equal(applyMove(state, move).fullmoveNumber, 3);
  });

  await t.test("double pawn push sets en passant target", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    const state = stateWith(board);
    const doublePush = generatePseudoLegalMoves(state).find((m) => m.to[0] === 4 && m.to[1] === 4);
    assert.deepEqual(applyMove(state, doublePush).enPassant, [5, 4]);
  });

  await t.test("non-double push clears en passant target", () => {
    const board = emptyBoard();
    board[6][4] = { type: "P", color: "w" };
    const state = stateWith(board, { enPassant: [2, 2] });
    const singlePush = generatePseudoLegalMoves(state).find((m) => m.to[0] === 5 && m.to[1] === 4);
    assert.equal(applyMove(state, singlePush).enPassant, null);
  });

  await t.test("promotion places the chosen piece", () => {
    const board = emptyBoard();
    board[1][0] = { type: "P", color: "w" };
    const state = stateWith(board);
    const toQueen = generatePseudoLegalMoves(state).find((m) => m.promotion === "Q");
    assert.deepEqual(applyMove(state, toQueen).board[0][0], { type: "Q", color: "w" });
  });

  await t.test("king move revokes both castling rights", () => {
    const board = emptyBoard();
    board[7][4] = { type: "K", color: "w" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: true, bQ: true } });
    const move = generatePseudoLegalMoves(state)[0];
    const next = applyMove(state, move);
    assert.equal(next.castling.wK, false);
    assert.equal(next.castling.wQ, false);
    assert.equal(next.castling.bK, true);
  });

  await t.test("rook move revokes only its side castling right", () => {
    const board = emptyBoard();
    board[7][0] = { type: "R", color: "w" };
    const state = stateWith(board, { castling: { wK: true, wQ: true, bK: true, bQ: true } });
    const move = generatePseudoLegalMoves(state)[0];
    const next = applyMove(state, move);
    assert.equal(next.castling.wQ, false);
    assert.equal(next.castling.wK, true);
  });

  await t.test("capturing a rook on its home square revokes that right", () => {
    const board = emptyBoard();
    board[4][0] = { type: "R", color: "w" };
    board[0][0] = { type: "R", color: "b" };
    const state = stateWith(board, { castling: { wK: false, wQ: false, bK: true, bQ: true } });
    const capture = generatePseudoLegalMoves(state).find((m) => m.to[0] === 0 && m.to[1] === 0);
    const next = applyMove(state, capture);
    assert.equal(next.castling.bQ, false);
    assert.equal(next.castling.bK, true);
  });
});

test("loadFen", async (t) => {
  await t.test("starting position FEN matches initialState", () => {
    const state = loadFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    assert.deepEqual(state.board, initialState().board);
    assert.equal(state.turn, "w");
    assert.deepEqual(state.castling, { wK: true, wQ: true, bK: true, bQ: true });
    assert.equal(state.enPassant, null);
  });

  await t.test("partial castling rights", () => {
    const state = loadFen("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
    assert.deepEqual(state.castling, { wK: true, wQ: false, bK: false, bQ: false });
    assert.deepEqual(state.board[7][7], { type: "R", color: "w" });
    assert.deepEqual(state.board[0][4], { type: "K", color: "b" });
  });

  await t.test("en passant square and move counters", () => {
    const state = loadFen("4k3/8/8/8/4Pp2/8/8/4K3 b - e3 0 5");
    assert.deepEqual(state.enPassant, squareToRc("e3"));
    assert.equal(state.turn, "b");
    assert.equal(state.halfmoveClock, 0);
    assert.equal(state.fullmoveNumber, 5);
  });

  await t.test("empty square run lengths", () => {
    const state = loadFen("8/8/8/8/8/8/8/8 w - - 0 1");
    assert.ok(state.board.every((row) => row.every((cell) => cell === null)));
  });
});
