"""
Check detection and legal-move filtering, built on top of
chess_logic's pseudo-legal move generation and apply_move. Still
pure: nothing here mutates its inputs.

"Legal" means: pseudo-legal, AND does not leave the mover's own king
in check afterward. This module finds legal moves by generating
pseudo-legal moves, applying each one, and checking whether the
resulting position leaves the mover's king attacked -- straightforward
to read and to get right, which matters more here than raw speed
(perft tests are what actually prove this correct).
"""

from chess_logic import apply_move, generate_pseudo_legal_moves, in_bounds, opposite_color

_KNIGHT_DELTAS = [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)]
_DIAGONAL_DELTAS = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
_ORTHOGONAL_DELTAS = [(-1, 0), (1, 0), (0, -1), (0, 1)]
_KING_DELTAS = _DIAGONAL_DELTAS + _ORTHOGONAL_DELTAS


def find_king(board, color):
    for row in range(8):
        for col in range(8):
            piece = board[row][col]
            if piece is not None and piece["type"] == "K" and piece["color"] == color:
                return (row, col)
    return None


def _pawn_attacks_square(board, row, col, by_color):
    pawn_row = row + 1 if by_color == "w" else row - 1
    if not in_bounds(pawn_row, 0):
        return False
    for pawn_col in (col - 1, col + 1):
        if in_bounds(pawn_row, pawn_col):
            piece = board[pawn_row][pawn_col]
            if piece is not None and piece["type"] == "P" and piece["color"] == by_color:
                return True
    return False


def _step_attacks_square(board, row, col, by_color, deltas, piece_types):
    for d_row, d_col in deltas:
        r, c = row + d_row, col + d_col
        if not in_bounds(r, c):
            continue
        piece = board[r][c]
        if piece is not None and piece["color"] == by_color and piece["type"] in piece_types:
            return True
    return False


def _sliding_attacks_square(board, row, col, by_color, deltas, piece_types):
    for d_row, d_col in deltas:
        r, c = row + d_row, col + d_col
        while in_bounds(r, c):
            piece = board[r][c]
            if piece is not None:
                if piece["color"] == by_color and piece["type"] in piece_types:
                    return True
                break
            r, c = r + d_row, c + d_col
    return False


def is_square_attacked(board, row, col, by_color):
    """Is (row, col) attacked by any piece of `by_color` on this board?"""
    if _pawn_attacks_square(board, row, col, by_color):
        return True
    if _step_attacks_square(board, row, col, by_color, _KNIGHT_DELTAS, {"N"}):
        return True
    if _step_attacks_square(board, row, col, by_color, _KING_DELTAS, {"K"}):
        return True
    if _sliding_attacks_square(board, row, col, by_color, _DIAGONAL_DELTAS, {"B", "Q"}):
        return True
    if _sliding_attacks_square(board, row, col, by_color, _ORTHOGONAL_DELTAS, {"R", "Q"}):
        return True
    return False


def is_in_check(state, color):
    king_square = find_king(state["board"], color)
    if king_square is None:
        return False
    return is_square_attacked(state["board"], king_square[0], king_square[1], opposite_color(color))


def generate_legal_moves(state, pseudo_legal_moves=None):
    """
    Filter pseudo-legal moves down to those that don't leave the
    mover's own king in check. Defaults to ordinary-piece pseudo-legal
    moves; chess_special.py passes in a list that also includes
    castling and en passant so those get the same safety filter.
    """
    mover = state["turn"]
    if pseudo_legal_moves is None:
        pseudo_legal_moves = generate_pseudo_legal_moves(state)
    legal = []
    for move in pseudo_legal_moves:
        resulting_state = apply_move(state, move)
        if not is_in_check(resulting_state, mover):
            legal.append(move)
    return legal
