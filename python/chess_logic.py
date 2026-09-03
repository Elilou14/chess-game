"""
Pure chess rules engine -- no I/O, no globals, no mutation of its
inputs. Every function takes a state (or board) in and returns new
data out, which is what makes it testable with plain unittest.

Board layout: an 8x8 list of lists. Row 0 is rank 8 (black's back
rank), row 7 is rank 1 (white's back rank). Column 0 is file 'a',
column 7 is file 'h'. An empty square is None; an occupied square is
{"type": "P"|"N"|"B"|"R"|"Q"|"K", "color": "w"|"b"}.

This module covers ordinary piece movement (pseudo-legal -- it does
not yet check whether a move leaves the mover's own king in check)
and the state-transition mechanics of applying a move -- including
executing a castle (moving the rook too) or an en passant capture
(removing the pawn beside the destination square) when a move flagged
that way is passed in. Check detection and legal-move filtering live
in chess_check.py; castling and en passant *generation* -- deciding
when those moves are available -- lives in chess_special.py.
"""

PIECE_TYPES = {"P", "N", "B", "R", "Q", "K"}
PROMOTION_TYPES = ("Q", "R", "B", "N")

_BACK_RANK = ["R", "N", "B", "Q", "K", "B", "N", "R"]


def opposite_color(color):
    return "b" if color == "w" else "w"


def in_bounds(row, col):
    return 0 <= row < 8 and 0 <= col < 8


def piece_at(board, row, col):
    return board[row][col]


def square_to_rc(square):
    """'e2' -> (row, col). Row 0 is rank 8, so rank 2 is row 6."""
    file_char, rank_char = square[0], square[1]
    col = ord(file_char) - ord("a")
    row = 8 - int(rank_char)
    return row, col


def rc_to_square(row, col):
    file_char = chr(ord("a") + col)
    rank_char = str(8 - row)
    return f"{file_char}{rank_char}"


def copy_board(board):
    return [row[:] for row in board]


def initial_state():
    board = [[None] * 8 for _ in range(8)]
    for col in range(8):
        board[0][col] = {"type": _BACK_RANK[col], "color": "b"}
        board[1][col] = {"type": "P", "color": "b"}
        board[6][col] = {"type": "P", "color": "w"}
        board[7][col] = {"type": _BACK_RANK[col], "color": "w"}

    return {
        "board": board,
        "turn": "w",
        "castling": {"wK": True, "wQ": True, "bK": True, "bQ": True},
        "en_passant": None,
        "halfmove_clock": 0,
        "fullmove_number": 1,
    }


def make_move(from_rc, to_rc, piece, captured=None, promotion=None, is_en_passant=False, castle=None):
    return {
        "from": from_rc,
        "to": to_rc,
        "piece": piece,
        "captured": captured,
        "promotion": promotion,
        "is_en_passant": is_en_passant,
        "castle": castle,
    }


def _slide_moves(board, row, col, piece, deltas):
    moves = []
    color = piece["color"]
    for d_row, d_col in deltas:
        r, c = row + d_row, col + d_col
        while in_bounds(r, c):
            target = board[r][c]
            if target is None:
                moves.append(make_move((row, col), (r, c), piece))
            elif target["color"] != color:
                moves.append(make_move((row, col), (r, c), piece, captured=target))
                break
            else:
                break
            r, c = r + d_row, c + d_col
    return moves


def _step_moves(board, row, col, piece, deltas):
    moves = []
    color = piece["color"]
    for d_row, d_col in deltas:
        r, c = row + d_row, col + d_col
        if not in_bounds(r, c):
            continue
        target = board[r][c]
        if target is None:
            moves.append(make_move((row, col), (r, c), piece))
        elif target["color"] != color:
            moves.append(make_move((row, col), (r, c), piece, captured=target))
    return moves


def _pawn_moves(board, row, col, piece):
    moves = []
    color = piece["color"]
    direction = -1 if color == "w" else 1
    start_row = 6 if color == "w" else 1
    promotion_row = 0 if color == "w" else 7

    def add_forward_or_capture(r, c, captured):
        if r == promotion_row:
            for promo in PROMOTION_TYPES:
                moves.append(make_move((row, col), (r, c), piece, captured=captured, promotion=promo))
        else:
            moves.append(make_move((row, col), (r, c), piece, captured=captured))

    one_row = row + direction
    if in_bounds(one_row, col) and board[one_row][col] is None:
        add_forward_or_capture(one_row, col, None)
        two_row = row + 2 * direction
        if row == start_row and board[two_row][col] is None:
            moves.append(make_move((row, col), (two_row, col), piece))

    for d_col in (-1, 1):
        r, c = row + direction, col + d_col
        if not in_bounds(r, c):
            continue
        target = board[r][c]
        if target is not None and target["color"] != color:
            add_forward_or_capture(r, c, target)

    return moves


_KNIGHT_DELTAS = [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)]
_BISHOP_DELTAS = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
_ROOK_DELTAS = [(-1, 0), (1, 0), (0, -1), (0, 1)]
_QUEEN_DELTAS = _BISHOP_DELTAS + _ROOK_DELTAS
_KING_DELTAS = _QUEEN_DELTAS


def generate_pseudo_legal_moves(state):
    """
    All moves for the side to move that follow each piece's movement
    pattern, WITHOUT checking whether the move leaves that side's own
    king in check. Does not include castling or en passant capture --
    see chess_special.py.
    """
    board = state["board"]
    color = state["turn"]
    moves = []

    for row in range(8):
        for col in range(8):
            piece = board[row][col]
            if piece is None or piece["color"] != color:
                continue

            if piece["type"] == "P":
                moves.extend(_pawn_moves(board, row, col, piece))
            elif piece["type"] == "N":
                moves.extend(_step_moves(board, row, col, piece, _KNIGHT_DELTAS))
            elif piece["type"] == "B":
                moves.extend(_slide_moves(board, row, col, piece, _BISHOP_DELTAS))
            elif piece["type"] == "R":
                moves.extend(_slide_moves(board, row, col, piece, _ROOK_DELTAS))
            elif piece["type"] == "Q":
                moves.extend(_slide_moves(board, row, col, piece, _QUEEN_DELTAS))
            elif piece["type"] == "K":
                moves.extend(_step_moves(board, row, col, piece, _KING_DELTAS))

    return moves


def _update_castling_rights(castling, piece, from_rc, captured, to_rc):
    castling = dict(castling)
    color = piece["color"]

    if piece["type"] == "K":
        castling[f"{color}K"] = False
        castling[f"{color}Q"] = False
    elif piece["type"] == "R":
        home_row = 7 if color == "w" else 0
        if from_rc == (home_row, 0):
            castling[f"{color}Q"] = False
        elif from_rc == (home_row, 7):
            castling[f"{color}K"] = False

    if captured is not None and captured["type"] == "R":
        enemy = opposite_color(color)
        home_row = 7 if enemy == "w" else 0
        if to_rc == (home_row, 0):
            castling[f"{enemy}Q"] = False
        elif to_rc == (home_row, 7):
            castling[f"{enemy}K"] = False

    return castling


def apply_move(state, move):
    """Pure: returns a new state with `move` applied. Does not mutate `state`."""
    board = copy_board(state["board"])
    from_row, from_col = move["from"]
    to_row, to_col = move["to"]
    piece = move["piece"]

    board[from_row][from_col] = None

    if move["is_en_passant"]:
        # The captured pawn sits beside the mover, not on the destination square.
        board[from_row][to_col] = None

    placed = {"type": move["promotion"], "color": piece["color"]} if move["promotion"] else piece
    board[to_row][to_col] = placed

    if move["castle"]:
        home_row = from_row
        if move["castle"] == "K":
            rook_from_col, rook_to_col = 7, 5
        else:
            rook_from_col, rook_to_col = 0, 3
        rook = board[home_row][rook_from_col]
        board[home_row][rook_from_col] = None
        board[home_row][rook_to_col] = rook

    is_pawn_move = piece["type"] == "P"
    is_capture = move["captured"] is not None
    halfmove_clock = 0 if (is_pawn_move or is_capture) else state["halfmove_clock"] + 1

    fullmove_number = state["fullmove_number"] + (1 if state["turn"] == "b" else 0)

    en_passant = None
    if is_pawn_move and abs(to_row - from_row) == 2:
        en_passant = ((from_row + to_row) // 2, from_col)

    castling = _update_castling_rights(state["castling"], piece, move["from"], move["captured"], move["to"])

    return {
        "board": board,
        "turn": opposite_color(state["turn"]),
        "castling": castling,
        "en_passant": en_passant,
        "halfmove_clock": halfmove_clock,
        "fullmove_number": fullmove_number,
    }
