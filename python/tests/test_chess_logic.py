import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chess_logic import (
    apply_move,
    generate_pseudo_legal_moves,
    initial_state,
    rc_to_square,
    square_to_rc,
)


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


class SquareNotationTests(unittest.TestCase):
    def test_square_to_rc(self):
        self.assertEqual(square_to_rc("a8"), (0, 0))
        self.assertEqual(square_to_rc("h1"), (7, 7))
        self.assertEqual(square_to_rc("e2"), (6, 4))

    def test_rc_to_square(self):
        self.assertEqual(rc_to_square(0, 0), "a8")
        self.assertEqual(rc_to_square(7, 7), "h1")
        self.assertEqual(rc_to_square(6, 4), "e2")

    def test_round_trip(self):
        for square in ["a1", "h8", "d4", "e2", "b7"]:
            self.assertEqual(rc_to_square(*square_to_rc(square)), square)


class InitialStateTests(unittest.TestCase):
    def test_white_back_rank_and_pawns(self):
        state = initial_state()
        board = state["board"]
        self.assertEqual(board[7][0], {"type": "R", "color": "w"})
        self.assertEqual(board[7][4], {"type": "K", "color": "w"})
        for col in range(8):
            self.assertEqual(board[6][col], {"type": "P", "color": "w"})

    def test_black_back_rank_and_pawns(self):
        state = initial_state()
        board = state["board"]
        self.assertEqual(board[0][0], {"type": "R", "color": "b"})
        self.assertEqual(board[0][4], {"type": "K", "color": "b"})
        for col in range(8):
            self.assertEqual(board[1][col], {"type": "P", "color": "b"})

    def test_middle_ranks_empty(self):
        state = initial_state()
        board = state["board"]
        for row in range(2, 6):
            self.assertTrue(all(cell is None for cell in board[row]))

    def test_starting_metadata(self):
        state = initial_state()
        self.assertEqual(state["turn"], "w")
        self.assertEqual(state["castling"], {"wK": True, "wQ": True, "bK": True, "bQ": True})
        self.assertIsNone(state["en_passant"])
        self.assertEqual(state["halfmove_clock"], 0)
        self.assertEqual(state["fullmove_number"], 1)

    def test_initial_position_has_20_pseudo_legal_moves(self):
        # 16 pawn moves (2 each) + 4 knight moves (2 each) = 20.
        moves = generate_pseudo_legal_moves(initial_state())
        self.assertEqual(len(moves), 20)


class PawnMoveTests(unittest.TestCase):
    def test_single_and_double_push_from_start(self):
        board = empty_board()
        board[6][4] = {"type": "P", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(destinations(moves), [(4, 4), (5, 4)])

    def test_no_double_push_after_moving(self):
        board = empty_board()
        board[5][4] = {"type": "P", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(destinations(moves), [(4, 4)])

    def test_blocked_pawn_cannot_push(self):
        board = empty_board()
        board[6][4] = {"type": "P", "color": "w"}
        board[5][4] = {"type": "N", "color": "b"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(destinations(moves), [])

    def test_double_push_blocked_by_piece_on_second_square(self):
        board = empty_board()
        board[6][4] = {"type": "P", "color": "w"}
        board[4][4] = {"type": "N", "color": "b"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(destinations(moves), [(5, 4)])

    def test_diagonal_capture(self):
        board = empty_board()
        board[6][4] = {"type": "P", "color": "w"}
        board[5][3] = {"type": "N", "color": "b"}
        board[5][5] = {"type": "N", "color": "b"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(destinations(moves, from_rc=(6, 4)), [(4, 4), (5, 3), (5, 4), (5, 5)])

    def test_cannot_capture_own_piece_diagonally(self):
        board = empty_board()
        board[6][4] = {"type": "P", "color": "w"}
        board[5][3] = {"type": "N", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(destinations(moves, from_rc=(6, 4)), [(4, 4), (5, 4)])

    def test_cannot_push_forward_onto_enemy(self):
        board = empty_board()
        board[6][4] = {"type": "P", "color": "w"}
        board[5][4] = {"type": "N", "color": "b"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(moves, [])

    def test_promotion_generates_four_moves(self):
        board = empty_board()
        board[1][0] = {"type": "P", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        promotions = sorted(m["promotion"] for m in moves)
        self.assertEqual(promotions, ["B", "N", "Q", "R"])
        self.assertTrue(all(m["to"] == (0, 0) for m in moves))

    def test_black_pawn_moves_downward(self):
        board = empty_board()
        board[1][4] = {"type": "P", "color": "b"}
        moves = generate_pseudo_legal_moves(state_with(board, turn="b"))
        self.assertEqual(destinations(moves), [(2, 4), (3, 4)])


class KnightMoveTests(unittest.TestCase):
    def test_center_knight_has_eight_moves(self):
        board = empty_board()
        board[4][4] = {"type": "N", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(len(moves), 8)

    def test_corner_knight_has_two_moves(self):
        board = empty_board()
        board[0][0] = {"type": "N", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(sorted(destinations(moves)), sorted([(2, 1), (1, 2)]))

    def test_blocked_by_own_piece(self):
        board = empty_board()
        board[4][4] = {"type": "N", "color": "w"}
        board[2][3] = {"type": "P", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(len(destinations(moves, from_rc=(4, 4))), 7)

    def test_captures_enemy(self):
        board = empty_board()
        board[4][4] = {"type": "N", "color": "w"}
        board[2][3] = {"type": "P", "color": "b"}
        moves = generate_pseudo_legal_moves(state_with(board))
        capture = [m for m in moves if m["to"] == (2, 3)][0]
        self.assertIsNotNone(capture["captured"])


class SlidingPieceMoveTests(unittest.TestCase):
    def test_rook_on_empty_board_has_fourteen_moves(self):
        board = empty_board()
        board[4][4] = {"type": "R", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(len(moves), 14)

    def test_bishop_on_empty_board_has_thirteen_moves(self):
        board = empty_board()
        board[4][4] = {"type": "B", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(len(moves), 13)

    def test_queen_on_empty_board_has_twenty_seven_moves(self):
        board = empty_board()
        board[4][4] = {"type": "Q", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(len(moves), 27)

    def test_rook_stops_before_own_piece(self):
        board = empty_board()
        board[4][4] = {"type": "R", "color": "w"}
        board[4][6] = {"type": "P", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertIn((4, 5), destinations(moves))
        self.assertNotIn((4, 6), destinations(moves))
        self.assertNotIn((4, 7), destinations(moves))

    def test_rook_captures_and_stops_on_enemy(self):
        board = empty_board()
        board[4][4] = {"type": "R", "color": "w"}
        board[4][6] = {"type": "P", "color": "b"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertIn((4, 6), destinations(moves))
        self.assertNotIn((4, 7), destinations(moves))


class KingMoveTests(unittest.TestCase):
    def test_center_king_has_eight_moves(self):
        board = empty_board()
        board[4][4] = {"type": "K", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(len(moves), 8)

    def test_corner_king_has_three_moves(self):
        board = empty_board()
        board[0][0] = {"type": "K", "color": "w"}
        moves = generate_pseudo_legal_moves(state_with(board))
        self.assertEqual(len(moves), 3)


class ApplyMoveTests(unittest.TestCase):
    def test_moves_piece_and_clears_origin(self):
        state = initial_state()
        moves = generate_pseudo_legal_moves(state)
        e2e4 = next(m for m in moves if m["from"] == (6, 4) and m["to"] == (4, 4))
        new_state = apply_move(state, e2e4)
        self.assertIsNone(new_state["board"][6][4])
        self.assertEqual(new_state["board"][4][4], {"type": "P", "color": "w"})

    def test_does_not_mutate_original_state(self):
        state = initial_state()
        moves = generate_pseudo_legal_moves(state)
        e2e4 = next(m for m in moves if m["from"] == (6, 4) and m["to"] == (4, 4))
        apply_move(state, e2e4)
        self.assertEqual(state["board"][6][4], {"type": "P", "color": "w"})
        self.assertIsNone(state["board"][4][4])

    def test_turn_flips(self):
        state = initial_state()
        moves = generate_pseudo_legal_moves(state)
        move = moves[0]
        new_state = apply_move(state, move)
        self.assertEqual(new_state["turn"], "b")

    def test_halfmove_clock_resets_on_pawn_move(self):
        state = initial_state()
        state["halfmove_clock"] = 5
        moves = generate_pseudo_legal_moves(state)
        pawn_move = next(m for m in moves if m["piece"]["type"] == "P")
        new_state = apply_move(state, pawn_move)
        self.assertEqual(new_state["halfmove_clock"], 0)

    def test_halfmove_clock_increments_on_non_pawn_non_capture(self):
        board = empty_board()
        board[4][4] = {"type": "N", "color": "w"}
        board[0][0] = {"type": "K", "color": "b"}
        state = state_with(board, halfmove_clock=3)
        moves = generate_pseudo_legal_moves(state)
        move = moves[0]
        new_state = apply_move(state, move)
        self.assertEqual(new_state["halfmove_clock"], 4)

    def test_halfmove_clock_resets_on_capture(self):
        board = empty_board()
        board[4][4] = {"type": "N", "color": "w"}
        board[2][3] = {"type": "P", "color": "b"}
        state = state_with(board, halfmove_clock=7)
        moves = generate_pseudo_legal_moves(state)
        capture = next(m for m in moves if m["captured"] is not None)
        new_state = apply_move(state, capture)
        self.assertEqual(new_state["halfmove_clock"], 0)

    def test_fullmove_number_increments_after_black_moves(self):
        board = empty_board()
        board[4][4] = {"type": "N", "color": "b"}
        state = state_with(board, turn="b", fullmove_number=3)
        moves = generate_pseudo_legal_moves(state)
        new_state = apply_move(state, moves[0])
        self.assertEqual(new_state["fullmove_number"], 4)

    def test_fullmove_number_unchanged_after_white_moves(self):
        board = empty_board()
        board[4][4] = {"type": "N", "color": "w"}
        state = state_with(board, fullmove_number=3)
        moves = generate_pseudo_legal_moves(state)
        new_state = apply_move(state, moves[0])
        self.assertEqual(new_state["fullmove_number"], 3)

    def test_double_pawn_push_sets_en_passant_target(self):
        board = empty_board()
        board[6][4] = {"type": "P", "color": "w"}
        state = state_with(board)
        moves = generate_pseudo_legal_moves(state)
        double_push = next(m for m in moves if m["to"] == (4, 4))
        new_state = apply_move(state, double_push)
        self.assertEqual(new_state["en_passant"], (5, 4))

    def test_non_double_push_clears_en_passant_target(self):
        board = empty_board()
        board[6][4] = {"type": "P", "color": "w"}
        state = state_with(board, en_passant=(2, 2))
        moves = generate_pseudo_legal_moves(state)
        single_push = next(m for m in moves if m["to"] == (5, 4))
        new_state = apply_move(state, single_push)
        self.assertIsNone(new_state["en_passant"])

    def test_promotion_places_the_chosen_piece(self):
        board = empty_board()
        board[1][0] = {"type": "P", "color": "w"}
        state = state_with(board)
        moves = generate_pseudo_legal_moves(state)
        to_queen = next(m for m in moves if m["promotion"] == "Q")
        new_state = apply_move(state, to_queen)
        self.assertEqual(new_state["board"][0][0], {"type": "Q", "color": "w"})

    def test_king_move_revokes_both_castling_rights(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        state = state_with(board, castling={"wK": True, "wQ": True, "bK": True, "bQ": True})
        moves = generate_pseudo_legal_moves(state)
        move = moves[0]
        new_state = apply_move(state, move)
        self.assertFalse(new_state["castling"]["wK"])
        self.assertFalse(new_state["castling"]["wQ"])
        self.assertTrue(new_state["castling"]["bK"])

    def test_rook_move_revokes_only_its_side_castling_right(self):
        board = empty_board()
        board[7][0] = {"type": "R", "color": "w"}
        state = state_with(board, castling={"wK": True, "wQ": True, "bK": True, "bQ": True})
        moves = generate_pseudo_legal_moves(state)
        move = moves[0]
        new_state = apply_move(state, move)
        self.assertFalse(new_state["castling"]["wQ"])
        self.assertTrue(new_state["castling"]["wK"])

    def test_capturing_a_rook_on_its_home_square_revokes_that_right(self):
        board = empty_board()
        board[4][0] = {"type": "R", "color": "w"}
        board[0][0] = {"type": "R", "color": "b"}
        state = state_with(board, castling={"wK": False, "wQ": False, "bK": True, "bQ": True})
        moves = generate_pseudo_legal_moves(state)
        capture = next(m for m in moves if m["to"] == (0, 0))
        new_state = apply_move(state, capture)
        self.assertFalse(new_state["castling"]["bQ"])
        self.assertTrue(new_state["castling"]["bK"])


if __name__ == "__main__":
    unittest.main()
