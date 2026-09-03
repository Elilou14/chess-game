#!/usr/bin/env python3
"""
Chess CLI -- play against the computer, four difficulty levels, in
the terminal.
"""

import argparse
import sys

from chess_ai import DIFFICULTY_PRESETS, choose_ai_move
from chess_board_render import render_board
from chess_check import is_in_check
from chess_end import get_game_status, position_key
from chess_logic import apply_move, initial_state, rc_to_square, square_to_rc
from chess_special import generate_legal_moves

STATUS_MESSAGES = {
    "checkmate": "Echec et mat.",
    "stalemate": "Pat -- partie nulle.",
    "draw_50_move": "Nulle par la regle des 50 coups.",
    "draw_repetition": "Nulle par triple repetition.",
    "draw_insufficient_material": "Nulle -- materiel insuffisant pour mater.",
}

COLOR_NAMES = {"w": "Blancs", "b": "Noirs"}


def parse_move_input(text, legal_moves):
    """Parse 'e2e4' or 'e7e8q' against the legal move list. Returns (move, error_message)."""
    text = text.strip().lower().replace(" ", "")
    if len(text) not in (4, 5):
        return None, "Format attendu : e2e4 (ou e7e8q pour une promotion)."

    try:
        from_rc = square_to_rc(text[0:2])
        to_rc = square_to_rc(text[2:4])
    except (IndexError, ValueError):
        return None, "Case invalide."

    promotion_map = {"q": "Q", "r": "R", "b": "B", "n": "N"}
    requested_promo = None
    if len(text) == 5:
        requested_promo = promotion_map.get(text[4])
        if requested_promo is None:
            return None, "Promotion invalide (q, r, b ou n)."

    matches = [m for m in legal_moves if m["from"] == from_rc and m["to"] == to_rc]
    if not matches:
        return None, "Ce coup n'est pas legal."

    if len(matches) == 1:
        return matches[0], None

    # Multiple matches only happens when the move is a promotion choice.
    if requested_promo is not None:
        for move in matches:
            if move["promotion"] == requested_promo:
                return move, None
        return None, "Promotion invalide (q, r, b ou n)."

    default_queen = next((m for m in matches if m["promotion"] == "Q"), matches[0])
    return default_queen, None


def describe_move(move):
    text = f"{rc_to_square(*move['from'])}{rc_to_square(*move['to'])}"
    if move["promotion"]:
        text += move["promotion"].lower()
    if move["castle"] == "K":
        text = "O-O"
    elif move["castle"] == "Q":
        text = "O-O-O"
    return text


def prompt_human_move(state, legal_moves):
    while True:
        raw = input("Votre coup (ex: e2e4, 'abandon' pour quitter) : ")
        if raw.strip().lower() in ("abandon", "quit", "quitter", "q"):
            return None
        move, error = parse_move_input(raw, legal_moves)
        if error:
            print(error)
            continue
        return move


def play(human_color, difficulty):
    state = initial_state()
    history = [position_key(state)]

    while True:
        print()
        print(render_board(state, perspective=human_color))
        print()

        status = get_game_status(state, position_history=history)
        if status != "ongoing":
            print(STATUS_MESSAGES[status])
            if status == "checkmate":
                winner = COLOR_NAMES["b" if state["turn"] == "w" else "w"]
                print(f"Victoire des {winner}.")
            return

        if is_in_check(state, state["turn"]):
            print(f"{COLOR_NAMES[state['turn']]} sont en echec.")

        legal_moves = generate_legal_moves(state)

        if state["turn"] == human_color:
            move = prompt_human_move(state, legal_moves)
            if move is None:
                print("Partie abandonnee.")
                return
        else:
            print("L'ordinateur reflechit...")
            move = choose_ai_move(state, difficulty)
            print(f"L'ordinateur joue {describe_move(move)}.")

        state = apply_move(state, move)
        history.append(position_key(state))


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Jouez aux echecs contre l'ordinateur dans le terminal.")
    parser.add_argument(
        "--difficulty",
        choices=list(DIFFICULTY_PRESETS.keys()),
        default="moyen",
        help="Niveau de l'IA (defaut: moyen).",
    )
    parser.add_argument(
        "--color",
        choices=["w", "b"],
        default="w",
        help="Couleur jouee par l'humain (defaut: w, les Blancs commencent).",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[1:])
    print("Chess CLI -- vous jouez contre l'ordinateur.")
    print(f"Niveau : {args.difficulty}. Vous jouez les {COLOR_NAMES[args.color]}.")
    try:
        play(args.color, args.difficulty)
    except (KeyboardInterrupt, EOFError):
        print("\nPartie interrompue.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
