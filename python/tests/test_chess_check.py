import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chess_check import generate_legal_moves, is_in_check, is_square_attacked
from chess_logic import initial_state


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


def destinations(moves, from_rc=None):
    if from_rc is not None:
        moves = [m for m in moves if m["from"] == from_rc]
    return sorted(m["to"] for m in moves)


class IsSquareAttackedTests(unittest.TestCase):
    def test_pawn_attacks_diagonally_forward(self):
        board = empty_board()
        board[4][4] = {"type": "P", "color": "w"}
        self.assertTrue(is_square_attacked(board, 3, 3, "w"))
        self.assertTrue(is_square_attacked(board, 3, 5, "w"))
        self.assertFalse(is_square_attacked(board, 3, 4, "w"))  # straight ahead is not an attack

    def test_black_pawn_attacks_the_other_way(self):
        board = empty_board()
        board[3][3] = {"type": "P", "color": "b"}
        self.assertTrue(is_square_attacked(board, 4, 4, "b"))
        self.assertFalse(is_square_attacked(board, 2, 2, "b"))

    def test_knight_attack(self):
        board = empty_board()
        board[4][4] = {"type": "N", "color": "w"}
        self.assertTrue(is_square_attacked(board, 2, 3, "w"))
        self.assertFalse(is_square_attacked(board, 4, 3, "w"))

    def test_king_attacks_adjacent_squares_only(self):
        board = empty_board()
        board[4][4] = {"type": "K", "color": "w"}
        self.assertTrue(is_square_attacked(board, 3, 4, "w"))
        self.assertFalse(is_square_attacked(board, 2, 4, "w"))

    def test_rook_attacks_along_open_file(self):
        board = empty_board()
        board[0][4] = {"type": "R", "color": "b"}
        self.assertTrue(is_square_attacked(board, 7, 4, "b"))

    def test_rook_attack_blocked_by_intervening_piece(self):
        board = empty_board()
        board[0][4] = {"type": "R", "color": "b"}
        board[4][4] = {"type": "P", "color": "w"}
        self.assertFalse(is_square_attacked(board, 7, 4, "b"))

    def test_bishop_attacks_diagonal(self):
        board = empty_board()
        board[0][0] = {"type": "B", "color": "b"}
        self.assertTrue(is_square_attacked(board, 7, 7, "b"))

    def test_queen_attacks_both_ways(self):
        board = empty_board()
        board[4][4] = {"type": "Q", "color": "w"}
        self.assertTrue(is_square_attacked(board, 4, 0, "w"))
        self.assertTrue(is_square_attacked(board, 0, 0, "w"))

    def test_empty_board_attacks_nothing(self):
        board = empty_board()
        self.assertFalse(is_square_attacked(board, 4, 4, "w"))
        self.assertFalse(is_square_attacked(board, 4, 4, "b"))


class IsInCheckTests(unittest.TestCase):
    def test_king_in_check_from_rook(self):
        board = empty_board()
        board[4][4] = {"type": "K", "color": "w"}
        board[4][0] = {"type": "R", "color": "b"}
        state = state_with(board)
        self.assertTrue(is_in_check(state, "w"))

    def test_king_not_in_check(self):
        board = empty_board()
        board[4][4] = {"type": "K", "color": "w"}
        board[0][0] = {"type": "R", "color": "b"}
        state = state_with(board)
        self.assertFalse(is_in_check(state, "w"))

    def test_initial_position_no_one_in_check(self):
        state = initial_state()
        self.assertFalse(is_in_check(state, "w"))
        self.assertFalse(is_in_check(state, "b"))


class GenerateLegalMovesTests(unittest.TestCase):
    def test_initial_position_has_twenty_legal_moves(self):
        moves = generate_legal_moves(initial_state())
        self.assertEqual(len(moves), 20)

    def test_pinned_piece_cannot_move_off_the_pin_line(self):
        # White king e1, white bishop e2 (pinned), black rook e8: the
        # bishop can't step off the e-file without exposing the king.
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[6][4] = {"type": "B", "color": "w"}
        board[0][4] = {"type": "R", "color": "b"}
        state = state_with(board)
        moves = generate_legal_moves(state)
        self.assertEqual(destinations(moves, from_rc=(6, 4)), [])

    def test_king_cannot_move_into_check(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][3] = {"type": "R", "color": "b"}
        state = state_with(board)
        moves = generate_legal_moves(state)
        king_dests = destinations(moves, from_rc=(7, 4))
        self.assertNotIn((7, 3), king_dests)  # d1 is attacked by the rook on the d-file
        self.assertIn((7, 5), king_dests)  # f1 is safe

    def test_check_can_be_resolved_by_capturing_the_checker(self):
        # King e1 in check from a rook on the e-file; a white rook on
        # a1 can swing along rank 1 to capture it on e8... instead,
        # simplest: put the white rook where it directly attacks the
        # checking rook.
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "R", "color": "b"}
        board[0][0] = {"type": "R", "color": "w"}
        state = state_with(board)
        self.assertTrue(is_in_check(state, "w"))
        moves = generate_legal_moves(state)
        capture = [m for m in moves if m["from"] == (0, 0) and m["to"] == (0, 4)]
        self.assertEqual(len(capture), 1)

    def test_check_can_be_resolved_by_blocking(self):
        # King e1 in check along the e-file; a rook on h4 can slide to
        # e4 (rank 4), landing on the e-file between checker and king.
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "R", "color": "b"}
        board[4][7] = {"type": "R", "color": "w"}
        state = state_with(board)
        moves = generate_legal_moves(state)
        blocking_moves = [m for m in moves if m["from"] == (4, 7) and m["to"] == (4, 4)]
        self.assertEqual(len(blocking_moves), 1)

    def test_moves_that_dont_address_check_are_illegal(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "R", "color": "b"}
        board[7][0] = {"type": "R", "color": "w"}  # can't help against the e-file check
        state = state_with(board)
        moves = generate_legal_moves(state)
        # The a1 rook has no legal moves: it can't block or capture the checker.
        self.assertEqual(destinations(moves, from_rc=(7, 0)), [])

    def test_checkmate_position_has_no_legal_moves(self):
        # Classic back-rank mate: white king h1 boxed in by its own
        # pawns, black rook delivers mate on the back rank.
        board = empty_board()
        board[7][7] = {"type": "K", "color": "w"}
        board[6][5] = {"type": "P", "color": "w"}
        board[6][6] = {"type": "P", "color": "w"}
        board[6][7] = {"type": "P", "color": "w"}
        board[7][0] = {"type": "R", "color": "b"}
        board[0][0] = {"type": "K", "color": "b"}
        state = state_with(board)
        self.assertTrue(is_in_check(state, "w"))
        moves = generate_legal_moves(state)
        self.assertEqual(moves, [])


if __name__ == "__main__":
    unittest.main()
