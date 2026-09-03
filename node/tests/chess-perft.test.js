import assert from "node:assert/strict";
import { test } from "node:test";

import { initialState, loadFen } from "../chess-logic.js";
import { perft } from "../chess-perft.js";

// Published-correct node counts for the standard starting position.
// https://www.chessprogramming.org/Perft_Results
test("starting position perft", async (t) => {
  await t.test("depth 1", () => assert.equal(perft(initialState(), 1), 20));
  await t.test("depth 2", () => assert.equal(perft(initialState(), 2), 400));
  await t.test("depth 3", () => assert.equal(perft(initialState(), 3), 8902));
  await t.test("depth 4", () => assert.equal(perft(initialState(), 4), 197281));
});

// "Kiwipete": a classic perft stress-test position packed with
// castling rights on both sides, an en passant target, pins, and
// promotions all interacting at once.
// https://www.chessprogramming.org/Perft_Results#Position_2
test("kiwipete perft", async (t) => {
  const state = loadFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
  await t.test("depth 1", () => assert.equal(perft(state, 1), 48));
  await t.test("depth 2", () => assert.equal(perft(state, 2), 2039));
  await t.test("depth 3", () => assert.equal(perft(state, 3), 97862));
});
