"""
Castling and en passant *generation* -- deciding when those moves are
available. Execution (moving the rook too, removing the en-passant-
captured pawn) lives in chess_logic.apply_move; this module only
builds the move dicts and knows when it's legal to offer them.

Also exposes the final, complete generate_legal_moves: ordinary
pseudo-legal moves + castling + en passant, filtered by
chess_check.generate_legal_moves for king safety. This is the
function everything else (AI, CLI, web) should call.
"""

from chess_check import generate_legal_moves as _filter_for_check
from chess_check import is_in_check, is_square_attacked
from chess_logic import generate_pseudo_legal_moves, in_bounds, make_move, opposite_color


def _castle_move(home_row, color, side):
    king = {"type": "K", "color": color}
    to_col = 6 if side == "K" else 2
    return make_move((home_row, 4), (home_row, to_col), king, castle=side)


def generate_castling_pseudo_legal_moves(state):
    """
    Castling is available when: the right hasn't been revoked, the
    squares between king and rook are empty, the king isn't currently
    in check, and the king's start/transit/landing squares aren't
    attacked (it can never move through or into check -- unlike an
    ordinary move, this has to be checked at generation time, not
    just on the resulting position, because the king passes *through*
    d1/f1 without stopping there).
    """
    moves = []
    color = state["turn"]
    board = state["board"]
    home_row = 7 if color == "w" else 0
    enemy = opposite_color(color)

    king = board[home_row][4]
    if king is None or king["type"] != "K" or king["color"] != color:
        return moves

    if is_in_check(state, color):
        return moves

    if state["castling"][f"{color}K"]:
        rook = board[home_row][7]
        path_clear = board[home_row][5] is None and board[home_row][6] is None
        if path_clear and rook is not None and rook["type"] == "R" and rook["color"] == color:
            if not is_square_attacked(board, home_row, 5, enemy) and not is_square_attacked(board, home_row, 6, enemy):
                moves.append(_castle_move(home_row, color, "K"))

    if state["castling"][f"{color}Q"]:
        rook = board[home_row][0]
        path_clear = board[home_row][1] is None and board[home_row][2] is None and board[home_row][3] is None
        if path_clear and rook is not None and rook["type"] == "R" and rook["color"] == color:
            if not is_square_attacked(board, home_row, 3, enemy) and not is_square_attacked(board, home_row, 2, enemy):
                moves.append(_castle_move(home_row, color, "Q"))

    return moves


def generate_en_passant_pseudo_legal_moves(state):
    """
    Available only right after the opponent's pawn double-pushed
    (state["en_passant"] names the skipped-over square), and only for
    a pawn of the side to move sitting beside it.
    """
    moves = []
    target = state["en_passant"]
    if target is None:
        return moves

    target_row, target_col = target
    color = state["turn"]
    direction = -1 if color == "w" else 1
    capturing_row = target_row - direction
    board = state["board"]

    for d_col in (-1, 1):
        capturing_col = target_col + d_col
        if not in_bounds(capturing_row, capturing_col):
            continue
        piece = board[capturing_row][capturing_col]
        if piece is not None and piece["type"] == "P" and piece["color"] == color:
            captured_pawn = board[capturing_row][target_col]
            moves.append(
                make_move(
                    (capturing_row, capturing_col),
                    (target_row, target_col),
                    piece,
                    captured=captured_pawn,
                    is_en_passant=True,
                )
            )

    return moves


def generate_all_pseudo_legal_moves(state):
    return (
        generate_pseudo_legal_moves(state)
        + generate_castling_pseudo_legal_moves(state)
        + generate_en_passant_pseudo_legal_moves(state)
    )


def generate_legal_moves(state):
    """The complete legal-move generator: every rule, king-safety filtered."""
    return _filter_for_check(state, generate_all_pseudo_legal_moves(state))
