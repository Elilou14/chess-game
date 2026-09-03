import { findKing, isInCheck } from "./chess-check.js";
import { getGameStatus, positionKey } from "./chess-end.js";
import { applyMove, initialState } from "./chess-logic.js";
import { generateLegalMoves } from "./chess-special.js";

const PIECE_GLYPHS = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };

const GAME_OVER_MESSAGES = {
  checkmate: (winnerLabel) => `Echec et mat. Victoire des ${winnerLabel}.`,
  stalemate: () => "Pat -- partie nulle.",
  draw_50_move: () => "Nulle par la regle des 50 coups.",
  draw_repetition: () => "Nulle par triple repetition.",
  draw_insufficient_material: () => "Nulle -- materiel insuffisant pour mater.",
};

const COLOR_LABELS = { w: "Blancs", b: "Noirs" };

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status-message");
const difficultySelect = document.getElementById("difficulty-select");
const colorSelect = document.getElementById("color-select");
const promotionModal = document.getElementById("promotion-modal");
const promotionChoicesEl = document.getElementById("promotion-choices");

const aiWorker = new Worker("worker.js", { type: "module" });

let state = initialState();
let humanColor = colorSelect.value;
let difficulty = difficultySelect.value;
let positionHistory = [positionKey(state)];
let legalMoves = generateLegalMoves(state);
let selectedSquare = null;
let lastMove = null;
let gameOver = false;
let aiThinking = false;

function perspectiveOrder() {
  return humanColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
}

function legalDestinationsFrom(row, col) {
  return legalMoves.filter((m) => m.from[0] === row && m.from[1] === col);
}

function renderBoard() {
  boardEl.innerHTML = "";
  const order = perspectiveOrder();

  const checkedKingSquare = isInCheck(state, state.turn) ? findKing(state.board, state.turn) : null;
  const selectedDestinations = selectedSquare ? legalDestinationsFrom(...selectedSquare) : [];

  for (const row of order) {
    for (const col of order) {
      const square = document.createElement("div");
      const isLight = (row + col) % 2 === 0;
      const classes = ["square", isLight ? "light" : "dark"];

      if (selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col) {
        classes.push("selected");
      }
      if (lastMove && ((lastMove.from[0] === row && lastMove.from[1] === col) || (lastMove.to[0] === row && lastMove.to[1] === col))) {
        classes.push("last-move");
      }
      if (checkedKingSquare && checkedKingSquare[0] === row && checkedKingSquare[1] === col) {
        classes.push("in-check");
      }

      const destination = selectedDestinations.find((m) => m.to[0] === row && m.to[1] === col);
      if (destination) {
        classes.push(destination.captured !== null ? "legal-capture" : "legal-move");
      }

      const piece = state.board[row][col];
      if (!gameOver && !aiThinking && state.turn === humanColor && piece && piece.color === humanColor) {
        classes.push("clickable-piece");
      }

      square.className = classes.join(" ");
      square.dataset.row = String(row);
      square.dataset.col = String(col);

      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = `piece ${piece.color === "w" ? "white" : "black"}`;
        pieceEl.textContent = PIECE_GLYPHS[piece.type];
        square.appendChild(pieceEl);
      }

      boardEl.appendChild(square);
    }
  }
}

function updateStatusMessage() {
  statusEl.classList.remove("check", "game-over");

  const status = getGameStatus(state, positionHistory);
  if (status !== "ongoing") {
    gameOver = true;
    statusEl.classList.add("game-over");
    const winnerLabel = COLOR_LABELS[state.turn === "w" ? "b" : "w"];
    statusEl.textContent = GAME_OVER_MESSAGES[status](winnerLabel);
    return;
  }

  gameOver = false;
  const turnLabel = aiThinking
    ? "L'IA reflechit..."
    : state.turn === humanColor
      ? "A vous de jouer."
      : "Tour de l'IA.";

  if (isInCheck(state, state.turn)) {
    statusEl.classList.add("check");
    statusEl.textContent = `${COLOR_LABELS[state.turn]} sont en echec. ${turnLabel}`;
  } else {
    statusEl.textContent = turnLabel;
  }
}

function render() {
  renderBoard();
  updateStatusMessage();
}

function requestAiMove() {
  aiThinking = true;
  render();
  aiWorker.postMessage({ state, difficulty });
}

aiWorker.onmessage = (event) => {
  aiThinking = false;
  const { move } = event.data;
  if (move) commitMove(move);
};

function commitMove(move) {
  state = applyMove(state, move);
  lastMove = move;
  positionHistory.push(positionKey(state));
  legalMoves = generateLegalMoves(state);
  selectedSquare = null;

  render();

  if (getGameStatus(state, positionHistory) !== "ongoing") return;
  if (state.turn !== humanColor) requestAiMove();
}

function showPromotionModal(candidates) {
  promotionChoicesEl.innerHTML = "";
  const color = candidates[0].piece.color;

  for (const move of candidates) {
    const btn = document.createElement("button");
    btn.className = "promotion-choice";
    btn.textContent = PIECE_GLYPHS[move.promotion];
    btn.style.color = color === "w" ? "#fbfbfb" : "#1a1a1a";
    if (color === "w") btn.style.webkitTextStroke = "1.4px #1c1c1c";
    btn.addEventListener("click", () => {
      promotionModal.hidden = true;
      commitMove(move);
    });
    promotionChoicesEl.appendChild(btn);
  }

  promotionModal.hidden = false;
}

function handleSquareClick(row, col) {
  if (selectedSquare) {
    const candidates = legalDestinationsFrom(...selectedSquare).filter((m) => m.to[0] === row && m.to[1] === col);
    if (candidates.length === 1) {
      commitMove(candidates[0]);
      return;
    }
    if (candidates.length > 1) {
      showPromotionModal(candidates);
      return;
    }
  }

  const piece = state.board[row][col];
  if (piece && piece.color === humanColor) {
    selectedSquare = [row, col];
  } else {
    selectedSquare = null;
  }
  renderBoard();
}

boardEl.addEventListener("click", (event) => {
  if (gameOver || aiThinking || state.turn !== humanColor) return;
  const squareEl = event.target.closest(".square");
  if (!squareEl) return;
  handleSquareClick(Number(squareEl.dataset.row), Number(squareEl.dataset.col));
});

render();
if (state.turn !== humanColor) requestAiMove();
