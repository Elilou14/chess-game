"""
ASCII board rendering: pure string-building, no I/O. Kept separate
from chess.py so it's easy to eyeball/test in isolation.
"""

RESET = "\033[0m"
BOLD = "\033[1m"
LIGHT_SQUARE_BG = "\033[48;5;223m"
DARK_SQUARE_BG = "\033[48;5;94m"
WHITE_PIECE_FG = "\033[97m"
BLACK_PIECE_FG = "\033[30m"

# Hollow glyphs for White, filled for Black -- shape carries the
# distinction, not just color, so pieces stay legible regardless of
# how a given terminal font renders 256-color backgrounds (a filled
# white-foreground piece can vanish against a light square; an
# outlined one doesn't).
PIECE_GLYPHS = {
    "w": {"K": "♔", "Q": "♕", "R": "♖", "B": "♗", "N": "♘", "P": "♙"},
    "b": {"K": "♚", "Q": "♛", "R": "♜", "B": "♝", "N": "♞", "P": "♟"},
}


def _square_colors(row, col):
    is_light = (row + col) % 2 == 0
    return LIGHT_SQUARE_BG if is_light else DARK_SQUARE_BG


def _cell(piece, bg):
    if piece is None:
        return f"{bg}   {RESET}"
    fg = WHITE_PIECE_FG if piece["color"] == "w" else BLACK_PIECE_FG
    glyph = PIECE_GLYPHS[piece["color"]][piece["type"]]
    return f"{bg}{BOLD}{fg} {glyph} {RESET}"


def render_board(state, perspective="w"):
    """
    Render the board as a multi-line string. `perspective` flips the
    board for a human playing Black, so their own pieces sit at the
    bottom -- the way an actual chessboard would be turned around.
    """
    board = state["board"]
    row_range = range(8) if perspective == "w" else range(7, -1, -1)
    col_range = range(8) if perspective == "w" else range(7, -1, -1)

    lines = []
    for row in row_range:
        rank_label = 8 - row
        cells = "".join(_cell(board[row][col], _square_colors(row, col)) for col in col_range)
        lines.append(f"{rank_label} {cells}")

    file_labels = [chr(ord("a") + col) for col in col_range]
    lines.append("  " + "".join(f" {f} " for f in file_labels))
    return "\n".join(lines)
