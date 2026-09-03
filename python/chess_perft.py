"""
Perft (performance test): count the leaf nodes of the legal-move tree
at a given depth. This is the standard way to validate a chess move
generator -- if perft's node counts match the known-correct published
values for well-studied positions, the generator handles every rule
correctly, including how rules interact (a pin that also involves an
en passant capture, castling rights lost by a capture rather than a
move, etc.), not just each rule in isolation the way the unit tests
in test_chess_*.py do.
"""

from chess_logic import apply_move
from chess_special import generate_legal_moves


def perft(state, depth):
    if depth == 0:
        return 1
    total = 0
    for move in generate_legal_moves(state):
        total += perft(apply_move(state, move), depth - 1)
    return total
