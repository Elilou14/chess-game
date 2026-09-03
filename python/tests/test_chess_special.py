import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chess_logic import apply_move
from chess_special import (
    generate_castling_pseudo_legal_moves,
    generate_en_passant_pseudo_legal_moves,
    generate_legal_moves,
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


class CastlingGenerationTests(unittest.TestCase):
    def setUp(self):
        self.board = empty_board()
        self.board[7][4] = {"type": "K", "color": "w"}
        self.board[7][0] = {"type": "R", "color": "w"}
        self.board[7][7] = {"type": "R", "color": "w"}

    def test_both_sides_available_with_clear_path_and_rights(self):
        state = state_with(self.board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        moves = generate_castling_pseudo_legal_moves(state)
        sides = sorted(m["castle"] for m in moves)
        self.assertEqual(sides, ["K", "Q"])

    def test_no_castling_without_rights(self):
        state = state_with(self.board, castling={"wK": False, "wQ": False, "bK": False, "bQ": False})
        self.assertEqual(generate_castling_pseudo_legal_moves(state), [])

    def test_kingside_blocked_by_piece(self):
        self.board[7][5] = {"type": "B", "color": "w"}
        state = state_with(self.board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        moves = generate_castling_pseudo_legal_moves(state)
        self.assertNotIn("K", [m["castle"] for m in moves])

    def test_queenside_blocked_by_piece(self):
        self.board[7][1] = {"type": "N", "color": "w"}
        state = state_with(self.board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        moves = generate_castling_pseudo_legal_moves(state)
        self.assertNotIn("Q", [m["castle"] for m in moves])

    def test_no_castling_while_in_check(self):
        self.board[0][4] = {"type": "R", "color": "b"}  # checks the king along the e-file
        state = state_with(self.board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        self.assertEqual(generate_castling_pseudo_legal_moves(state), [])

    def test_no_castling_through_attacked_square(self):
        self.board[0][5] = {"type": "R", "color": "b"}  # attacks f1, the king's transit square
        state = state_with(self.board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        moves = generate_castling_pseudo_legal_moves(state)
        self.assertNotIn("K", [m["castle"] for m in moves])

    def test_no_castling_into_attacked_square(self):
        self.board[0][6] = {"type": "R", "color": "b"}  # attacks g1, the king's landing square
        state = state_with(self.board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        moves = generate_castling_pseudo_legal_moves(state)
        self.assertNotIn("K", [m["castle"] for m in moves])

    def test_rook_attack_on_b1_does_not_block_queenside(self):
        # b1/b8 is on the rook's path but the king never lands or
        # passes there, so it being attacked doesn't matter.
        self.board[0][1] = {"type": "R", "color": "b"}
        state = state_with(self.board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        moves = generate_castling_pseudo_legal_moves(state)
        self.assertIn("Q", [m["castle"] for m in moves])


class CastlingExecutionTests(unittest.TestCase):
    def test_kingside_castle_moves_king_and_rook(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[7][7] = {"type": "R", "color": "w"}
        state = state_with(board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        move = generate_castling_pseudo_legal_moves(state)[0]
        new_state = apply_move(state, move)
        self.assertEqual(new_state["board"][7][6], {"type": "K", "color": "w"})
        self.assertEqual(new_state["board"][7][5], {"type": "R", "color": "w"})
        self.assertIsNone(new_state["board"][7][4])
        self.assertIsNone(new_state["board"][7][7])

    def test_queenside_castle_moves_king_and_rook(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[7][0] = {"type": "R", "color": "w"}
        state = state_with(board, castling={"wK": True, "wQ": True, "bK": False, "bQ": False})
        moves = generate_castling_pseudo_legal_moves(state)
        move = next(m for m in moves if m["castle"] == "Q")
        new_state = apply_move(state, move)
        self.assertEqual(new_state["board"][7][2], {"type": "K", "color": "w"})
        self.assertEqual(new_state["board"][7][3], {"type": "R", "color": "w"})
        self.assertIsNone(new_state["board"][7][0])

    def test_castling_revokes_both_rights(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[7][7] = {"type": "R", "color": "w"}
        state = state_with(board, castling={"wK": True, "wQ": True, "bK": True, "bQ": True})
        move = generate_castling_pseudo_legal_moves(state)[0]
        new_state = apply_move(state, move)
        self.assertFalse(new_state["castling"]["wK"])
        self.assertFalse(new_state["castling"]["wQ"])
        self.assertTrue(new_state["castling"]["bK"])


class EnPassantGenerationTests(unittest.TestCase):
    # White just played e2-e4 (row6,col4 -> row4,col4); the skipped
    # square e3 is (5, 4). A black pawn on d4 (row4, col3) can capture
    # en passant, landing on e3 and taking the e4 pawn.
    def test_available_immediately_after_double_push(self):
        board = empty_board()
        board[4][4] = {"type": "P", "color": "w"}  # e4, just double-pushed
        board[4][3] = {"type": "P", "color": "b"}  # d4, adjacent capturer
        state = state_with(board, turn="b", en_passant=(5, 4))
        moves = generate_en_passant_pseudo_legal_moves(state)
        self.assertEqual(len(moves), 1)
        self.assertEqual(moves[0]["from"], (4, 3))
        self.assertEqual(moves[0]["to"], (5, 4))
        self.assertTrue(moves[0]["is_en_passant"])

    def test_no_en_passant_without_a_target(self):
        board = empty_board()
        board[4][4] = {"type": "P", "color": "w"}
        board[4][3] = {"type": "P", "color": "b"}
        state = state_with(board, turn="b", en_passant=None)
        self.assertEqual(generate_en_passant_pseudo_legal_moves(state), [])

    def test_no_en_passant_without_an_adjacent_pawn(self):
        board = empty_board()
        state = state_with(board, turn="b", en_passant=(5, 4))
        self.assertEqual(generate_en_passant_pseudo_legal_moves(state), [])


class EnPassantExecutionTests(unittest.TestCase):
    def test_captures_the_pawn_beside_the_destination(self):
        board = empty_board()
        board[4][4] = {"type": "P", "color": "w"}
        board[4][3] = {"type": "P", "color": "b"}
        state = state_with(board, turn="b", en_passant=(5, 4))
        move = generate_en_passant_pseudo_legal_moves(state)[0]
        new_state = apply_move(state, move)
        self.assertEqual(new_state["board"][5][4], {"type": "P", "color": "b"})
        self.assertIsNone(new_state["board"][4][4])  # captured pawn removed
        self.assertIsNone(new_state["board"][4][3])  # mover's origin cleared

    def test_halfmove_clock_resets_on_en_passant_capture(self):
        board = empty_board()
        board[4][4] = {"type": "P", "color": "w"}
        board[4][3] = {"type": "P", "color": "b"}
        state = state_with(board, turn="b", en_passant=(5, 4), halfmove_clock=9)
        move = generate_en_passant_pseudo_legal_moves(state)[0]
        new_state = apply_move(state, move)
        self.assertEqual(new_state["halfmove_clock"], 0)


class GenerateLegalMovesIncludesSpecialMovesTests(unittest.TestCase):
    def test_legal_moves_include_castling_when_available(self):
        board = empty_board()
        board[7][4] = {"type": "K", "color": "w"}
        board[7][7] = {"type": "R", "color": "w"}
        board[0][4] = {"type": "K", "color": "b"}
        state = state_with(board, castling={"wK": True, "wQ": False, "bK": False, "bQ": False})
        moves = generate_legal_moves(state)
        self.assertTrue(any(m["castle"] == "K" for m in moves))

    def test_legal_moves_include_en_passant_when_available(self):
        board = empty_board()
        board[4][4] = {"type": "P", "color": "w"}
        board[4][3] = {"type": "P", "color": "b"}
        board[0][0] = {"type": "K", "color": "b"}
        board[7][0] = {"type": "K", "color": "w"}
        state = state_with(board, turn="b", en_passant=(5, 4))
        moves = generate_legal_moves(state)
        self.assertTrue(any(m["is_en_passant"] for m in moves))

    def test_en_passant_illegal_if_it_exposes_own_king(self):
        # White king a5, white pawn b5, black pawn c5 (just double-pushed
        # from c7), black rook h5: capturing en passant would remove the
        # b5/c5 pawns from the rank, opening the king to the rook's check.
        board = empty_board()
        board[3][0] = {"type": "K", "color": "w"}
        board[3][1] = {"type": "P", "color": "w"}
        board[3][2] = {"type": "P", "color": "b"}
        board[3][7] = {"type": "R", "color": "b"}
        board[0][7] = {"type": "K", "color": "b"}
        state = state_with(board, turn="w", en_passant=(2, 2))
        moves = generate_legal_moves(state)
        self.assertFalse(any(m["is_en_passant"] for m in moves))


class PromotionEndToEndTests(unittest.TestCase):
    def test_promotion_choice_appears_among_legal_moves(self):
        board = empty_board()
        board[1][0] = {"type": "P", "color": "w"}
        board[7][7] = {"type": "K", "color": "w"}
        board[0][7] = {"type": "K", "color": "b"}
        state = state_with(board)
        moves = generate_legal_moves(state)
        promotions = sorted(m["promotion"] for m in moves if m["from"] == (1, 0))
        self.assertEqual(promotions, ["B", "N", "Q", "R"])


if __name__ == "__main__":
    unittest.main()
