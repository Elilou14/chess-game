import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from chess_logic import initial_state, load_fen
from chess_perft import perft


class StartingPositionPerftTests(unittest.TestCase):
    """
    Published-correct node counts for the standard starting position.
    https://www.chessprogramming.org/Perft_Results
    """

    def test_depth_1(self):
        self.assertEqual(perft(initial_state(), 1), 20)

    def test_depth_2(self):
        self.assertEqual(perft(initial_state(), 2), 400)

    def test_depth_3(self):
        self.assertEqual(perft(initial_state(), 3), 8902)

    def test_depth_4(self):
        self.assertEqual(perft(initial_state(), 4), 197281)


class KiwipetePerftTests(unittest.TestCase):
    """
    "Kiwipete": a classic perft stress-test position packed with
    castling rights on both sides, an en passant target, pins, and
    promotions all interacting at once -- a generator that only gets
    each rule right in isolation usually fails this one.
    https://www.chessprogramming.org/Perft_Results#Position_2
    """

    def setUp(self):
        self.state = load_fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1")

    def test_depth_1(self):
        self.assertEqual(perft(self.state, 1), 48)

    def test_depth_2(self):
        self.assertEqual(perft(self.state, 2), 2039)

    def test_depth_3(self):
        self.assertEqual(perft(self.state, 3), 97862)


if __name__ == "__main__":
    unittest.main()
