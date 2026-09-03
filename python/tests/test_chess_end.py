import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chess_end import get_game_status, position_key
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


class GameStatusTests(unittest.TestCase):
    def test_starting_position_is_ongoing(self):
        self.assertEqual(get_game_status(initial_state()), "ongoing")

    def test_back_rank_checkmate(self):
        board = empty_board()
        board[7][7] = {"type": "K", "color": "w"}
        board[6][5] = {"type": "P", "color": "w"}
        board[6][6] = {"type": "P", "color": "w"}
        board[6][7] = {"type": "P", "color": "w"}
        board[7][0] = {"type": "R", "color": "b"}
        board[0][0] = {"type": "K", "color": "b"}
        state = state_with(board)
        self.assertEqual(get_game_status(state), "checkmate")

    def test_classic_queen_king_stalemate(self):
        board = empty_board()
        board[0][7] = {"type": "K", "color": "b"}  # h8
        board[1][5] = {"type": "K", "color": "w"}  # f7
        board[2][6] = {"type": "Q", "color": "w"}  # g6
        state = state_with(board, turn="b")
        self.assertEqual(get_game_status(state), "stalemate")

    def test_fifty_move_rule(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        board[7][0] = {"type": "R", "color": "w"}
        state = state_with(board, halfmove_clock=100)
        self.assertEqual(get_game_status(state), "draw_50_move")

    def test_below_fifty_move_threshold_is_not_a_draw_on_that_basis(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        board[7][0] = {"type": "R", "color": "w"}
        state = state_with(board, halfmove_clock=99)
        self.assertEqual(get_game_status(state), "ongoing")

    def test_checkmate_takes_precedence_over_fifty_move_rule(self):
        board = empty_board()
        board[7][7] = {"type": "K", "color": "w"}
        board[6][5] = {"type": "P", "color": "w"}
        board[6][6] = {"type": "P", "color": "w"}
        board[6][7] = {"type": "P", "color": "w"}
        board[7][0] = {"type": "R", "color": "b"}
        board[0][0] = {"type": "K", "color": "b"}
        state = state_with(board, halfmove_clock=100)
        self.assertEqual(get_game_status(state), "checkmate")

    def test_threefold_repetition(self):
        state = initial_state()
        key = position_key(state)
        history = [key, key, key]
        self.assertEqual(get_game_status(state, position_history=history), "draw_repetition")

    def test_twofold_repetition_is_not_a_draw(self):
        state = initial_state()
        key = position_key(state)
        history = [key, key]
        self.assertEqual(get_game_status(state, position_history=history), "ongoing")

    def test_king_vs_king_is_insufficient_material(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        state = state_with(board)
        self.assertEqual(get_game_status(state), "draw_insufficient_material")

    def test_king_and_knight_vs_king_is_insufficient(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[7][1] = {"type": "N", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        state = state_with(board)
        self.assertEqual(get_game_status(state), "draw_insufficient_material")

    def test_king_and_rook_vs_king_is_not_insufficient(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[7][0] = {"type": "R", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        state = state_with(board)
        self.assertEqual(get_game_status(state), "ongoing")


class PositionKeyTests(unittest.TestCase):
    def test_identical_positions_produce_the_same_key(self):
        state_a = initial_state()
        state_b = initial_state()
        self.assertEqual(position_key(state_a), position_key(state_b))

    def test_key_is_hashable(self):
        state = initial_state()
        {position_key(state)}  # raises if unhashable

    def test_different_side_to_move_changes_the_key(self):
        state = initial_state()
        other = dict(state, turn="b")
        self.assertNotEqual(position_key(state), position_key(other))

    def test_different_castling_rights_change_the_key(self):
        state = initial_state()
        other = dict(state, castling={"wK": False, "wQ": True, "bK": True, "bQ": True})
        self.assertNotEqual(position_key(state), position_key(other))

    def test_move_counters_do_not_affect_the_key(self):
        state = initial_state()
        other = dict(state, halfmove_clock=17, fullmove_number=9)
        self.assertEqual(position_key(state), position_key(other))


if __name__ == "__main__":
    unittest.main()
