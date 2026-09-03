import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chess_ai import choose_ai_move, choose_move_by_search, evaluate
from chess_logic import initial_state
from chess_special import generate_legal_moves


def empty_board():
    return [[None] * 8 for _ in range(8)]


def state_with(board, turn="w", castling=None, en_passant=None, halfmove_clock=0, fullmove_number=1):
    return {
        "board": board,
        "turn": turn,
        "castling": castling or {"wK": False, "wQ": False, "bK": False, "bQ": False},
        "en_passant": en_passant,
        "halfmove_clock": halfmove_clock,
        "fullmove_number": fullmove_number,
    }


class EvaluateTests(unittest.TestCase):
    def test_starting_position_is_balanced(self):
        self.assertEqual(evaluate(initial_state()), 0)

    def test_material_advantage_is_reflected(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        board[7][3] = {"type": "Q", "color": "w"}
        score = evaluate(state_with(board))
        self.assertGreater(score, 800)  # roughly a queen's worth, plus/minus PST noise

    def test_black_material_advantage_is_negative(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        board[0][3] = {"type": "Q", "color": "b"}
        score = evaluate(state_with(board))
        self.assertLess(score, -800)

    def test_central_knight_scores_higher_than_corner_knight(self):
        central = empty_board()
        central[7][4] = {"type": "K", "color": "w"}
        central[0][4] = {"type": "K", "color": "b"}
        central[4][4] = {"type": "N", "color": "w"}

        corner = empty_board()
        corner[7][4] = {"type": "K", "color": "w"}
        corner[0][4] = {"type": "K", "color": "b"}
        corner[7][0] = {"type": "N", "color": "w"}

        self.assertGreater(evaluate(state_with(central)), evaluate(state_with(corner)))


class SearchTacticsTests(unittest.TestCase):
    def setUp(self):
        # White mates in one: Ra1-a8# -- the black king on g8 is boxed
        # in by its own pawns, and nothing blocks the a-file/8th-rank.
        board = empty_board()
        board[7][0] = {"type": "R", "color": "w"}
        board[7][4] = {"type": "K", "color": "w"}
        board[0][6] = {"type": "K", "color": "b"}
        board[1][5] = {"type": "P", "color": "b"}
        board[1][6] = {"type": "P", "color": "b"}
        board[1][7] = {"type": "P", "color": "b"}
        self.mate_in_one_state = state_with(board)

        # An undefended black queen a white rook can simply take.
        board2 = empty_board()
        board2[7][0] = {"type": "R", "color": "w"}
        board2[7][4] = {"type": "K", "color": "w"}
        board2[0][0] = {"type": "Q", "color": "b"}
        board2[0][7] = {"type": "K", "color": "b"}
        self.hanging_queen_state = state_with(board2)

    def test_moyen_finds_mate_in_one(self):
        move = choose_ai_move(self.mate_in_one_state, "moyen")
        self.assertEqual((move["from"], move["to"]), ((7, 0), (0, 0)))

    def test_difficile_finds_mate_in_one(self):
        move = choose_ai_move(self.mate_in_one_state, "difficile")
        self.assertEqual((move["from"], move["to"]), ((7, 0), (0, 0)))

    def test_moyen_takes_the_hanging_queen(self):
        move = choose_ai_move(self.hanging_queen_state, "moyen")
        self.assertEqual((move["from"], move["to"]), ((7, 0), (0, 0)))

    def test_difficile_takes_the_hanging_queen(self):
        move = choose_ai_move(self.hanging_queen_state, "difficile")
        self.assertEqual((move["from"], move["to"]), ((7, 0), (0, 0)))

    def test_search_move_is_always_legal(self):
        legal = generate_legal_moves(self.hanging_queen_state)
        legal_pairs = {(m["from"], m["to"]) for m in legal}
        move = choose_move_by_search(self.hanging_queen_state, max_depth=3, time_budget=2.0)
        self.assertIn((move["from"], move["to"]), legal_pairs)


class FacileDifficultyTests(unittest.TestCase):
    def test_returns_a_legal_move(self):
        state = initial_state()
        legal_pairs = {(m["from"], m["to"]) for m in generate_legal_moves(state)}
        move = choose_ai_move(state, "facile", rng=random.Random(42))
        self.assertIn((move["from"], move["to"]), legal_pairs)

    def test_deterministic_with_a_seeded_rng(self):
        state = initial_state()
        move_a = choose_ai_move(state, "facile", rng=random.Random(7))
        move_b = choose_ai_move(state, "facile", rng=random.Random(7))
        self.assertEqual((move_a["from"], move_a["to"]), (move_b["from"], move_b["to"]))


class NoLegalMovesTests(unittest.TestCase):
    def test_returns_none_when_no_legal_moves_exist(self):
        board = empty_board()
        board[7][7] = {"type": "K", "color": "w"}
        board[6][5] = {"type": "P", "color": "w"}
        board[6][6] = {"type": "P", "color": "w"}
        board[6][7] = {"type": "P", "color": "w"}
        board[7][0] = {"type": "R", "color": "b"}
        board[0][0] = {"type": "K", "color": "b"}
        state = state_with(board)  # checkmate
        self.assertIsNone(choose_ai_move(state, "moyen"))


if __name__ == "__main__":
    unittest.main()
