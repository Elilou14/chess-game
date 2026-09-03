import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chess import describe_move, parse_move_input
from chess_board_render import render_board
from chess_logic import initial_state
from chess_special import generate_legal_moves


class ParseMoveInputTests(unittest.TestCase):
    def setUp(self):
        self.state = initial_state()
        self.legal_moves = generate_legal_moves(self.state)

    def test_parses_a_simple_move(self):
        move, error = parse_move_input("e2e4", self.legal_moves)
        self.assertIsNone(error)
        self.assertEqual((move["from"], move["to"]), ((6, 4), (4, 4)))

    def test_accepts_spaces_and_uppercase(self):
        move, error = parse_move_input("E2 E4", self.legal_moves)
        self.assertIsNone(error)
        self.assertEqual((move["from"], move["to"]), ((6, 4), (4, 4)))

    def test_rejects_bad_format(self):
        move, error = parse_move_input("e2", self.legal_moves)
        self.assertIsNone(move)
        self.assertIsNotNone(error)

    def test_rejects_illegal_move(self):
        move, error = parse_move_input("e2e5", self.legal_moves)
        self.assertIsNone(move)
        self.assertIsNotNone(error)

    def test_promotion_defaults_to_queen_when_unspecified(self):
        board = [[None] * 8 for _ in range(8)]
        board[1][0] = {"type": "P", "color": "w"}
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        state = {
            "board": board,
            "turn": "w",
            "castling": {"wK": False, "wQ": False, "bK": False, "bQ": False},
            "en_passant": None,
            "halfmove_clock": 0,
            "fullmove_number": 1,
        }
        legal_moves = generate_legal_moves(state)
        move, error = parse_move_input("a7a8", legal_moves)
        self.assertIsNone(error)
        self.assertEqual(move["promotion"], "Q")

    def test_promotion_letter_is_honored(self):
        board = [[None] * 8 for _ in range(8)]
        board[1][0] = {"type": "P", "color": "w"}
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        state = {
            "board": board,
            "turn": "w",
            "castling": {"wK": False, "wQ": False, "bK": False, "bQ": False},
            "en_passant": None,
            "halfmove_clock": 0,
            "fullmove_number": 1,
        }
        legal_moves = generate_legal_moves(state)
        move, error = parse_move_input("a7a8n", legal_moves)
        self.assertIsNone(error)
        self.assertEqual(move["promotion"], "N")

    def test_invalid_promotion_letter_is_rejected(self):
        board = [[None] * 8 for _ in range(8)]
        board[1][0] = {"type": "P", "color": "w"}
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        state = {
            "board": board,
            "turn": "w",
            "castling": {"wK": False, "wQ": False, "bK": False, "bQ": False},
            "en_passant": None,
            "halfmove_clock": 0,
            "fullmove_number": 1,
        }
        legal_moves = generate_legal_moves(state)
        move, error = parse_move_input("a7a8k", legal_moves)
        self.assertIsNone(move)
        self.assertIsNotNone(error)


class DescribeMoveTests(unittest.TestCase):
    def test_ordinary_move(self):
        move = {"from": (6, 4), "to": (4, 4), "promotion": None, "castle": None}
        self.assertEqual(describe_move(move), "e2e4")

    def test_promotion_move(self):
        move = {"from": (1, 0), "to": (0, 0), "promotion": "Q", "castle": None}
        self.assertEqual(describe_move(move), "a7a8q")

    def test_kingside_castle(self):
        move = {"from": (7, 4), "to": (7, 6), "promotion": None, "castle": "K"}
        self.assertEqual(describe_move(move), "O-O")

    def test_queenside_castle(self):
        move = {"from": (7, 4), "to": (7, 2), "promotion": None, "castle": "Q"}
        self.assertEqual(describe_move(move), "O-O-O")


class RenderBoardTests(unittest.TestCase):
    def test_renders_eight_ranks_and_a_file_row(self):
        output = render_board(initial_state())
        lines = output.split("\n")
        self.assertEqual(len(lines), 9)  # 8 ranks + the file-label row

    def test_contains_rank_and_file_labels(self):
        output = render_board(initial_state())
        for rank in "12345678":
            self.assertIn(rank, output)
        for file_letter in "abcdefgh":
            self.assertIn(file_letter, output)

    def test_black_perspective_flips_the_board(self):
        white_view = render_board(initial_state(), perspective="w")
        black_view = render_board(initial_state(), perspective="b")
        self.assertNotEqual(white_view, black_view)


if __name__ == "__main__":
    unittest.main()
