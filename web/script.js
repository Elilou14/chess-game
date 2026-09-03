import { findKing, isInCheck } from "./chess-check.js";
import { getGameStatus, positionKey } from "./chess-end.js";
import { applyMove, initialState } from "./chess-logic.js";
import { formatSan } from "./chess-notation.js";
import { generateLegalMoves } from "./chess-special.js";

// Hollow glyphs for White, filled for Black -- shape carries the
// distinction, not CSS color, so pieces stay legible regardless of
// browser/font support (Firefox in particular ignores the
// -webkit-text-stroke trick a same-glyph-set approach would need).
const PIECE_GLYPHS = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

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
const moveListEl = document.getElementById("move-list");
const difficultySelect = document.getElementById("difficulty-select");
const colorSelect = document.getElementById("color-select");
const newGameBtn = document.getElementById("new-game-btn");
const undoBtn = document.getElementById("undo-btn");
const promotionModal = document.getElementById("promotion-modal");
const promotionChoicesEl = document.getElementById("promotion-choices");

const aiWorker = new Worker("worker.js", { type: "module" });

let humanColor = colorSelect.value;
let state;
let stateHistory;
let positionHistory;
let moveHistory; // [{ move, san }]
let legalMoves;
let selectedSquare = null;
let gameOver = false;
let aiThinking = false;
let gameGeneration = 0;

function resetGameState() {
  state = initialState();
  stateHistory = [state];
  positionHistory = [positionKey(state)];
  moveHistory = [];
  legalMoves = generateLegalMoves(state);
  selectedSquare = null;
  gameOver = false;
  aiThinking = false;
  promotionModal.hidden = true;
}

function perspectiveOrder() {
  return humanColor === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
}

function legalDestinationsFrom(row, col) {
  return legalMoves.filter((m) => m.from[0] === row && m.from[1] === col);
}

function lastMove() {
  return moveHistory.length ? moveHistory[moveHistory.length - 1].move : null;
}

function renderBoard() {
  boardEl.innerHTML = "";
  const order = perspectiveOrder();
  const last = lastMove();

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
      if (last && ((last.from[0] === row && last.from[1] === col) || (last.to[0] === row && last.to[1] === col))) {
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
        pieceEl.textContent = PIECE_GLYPHS[piece.color][piece.type];
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

function renderMoveList() {
  moveListEl.innerHTML = "";
  for (let i = 0; i < moveHistory.length; i += 2) {
    const li = document.createElement("li");

    const numberEl = document.createElement("span");
    numberEl.className = "move-number";
    numberEl.textContent = `${i / 2 + 1}.`;

    const whiteEl = document.createElement("span");
    whiteEl.textContent = moveHistory[i]?.san ?? "";

    const blackEl = document.createElement("span");
    blackEl.textContent = moveHistory[i + 1]?.san ?? "";

    li.append(numberEl, whiteEl, blackEl);
    moveListEl.appendChild(li);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function updateUndoButton() {
  undoBtn.disabled = aiThinking || stateHistory.length <= 1;
}

function render() {
  renderBoard();
  updateStatusMessage();
  updateUndoButton();
}

function requestAiMove() {
  aiThinking = true;
  render();
  const generation = gameGeneration;
  aiWorker.postMessage({ state, difficulty: difficultySelect.value, generation });
}

aiWorker.onmessage = (event) => {
  const { move, generation } = event.data;
  if (generation !== gameGeneration) return; // stale reply from before a new game/undo
  aiThinking = false;
  if (move) commitMove(move);
};

function commitMove(move) {
  const legalMovesBeforeMove = legalMoves;
  const nextState = applyMove(state, move);
  const san = formatSan(move, legalMovesBeforeMove, nextState);

  state = nextState;
  stateHistory.push(state);
  positionHistory.push(positionKey(state));
  moveHistory.push({ move, san });
  legalMoves = generateLegalMoves(state);
  selectedSquare = null;

  render();
  renderMoveList();

  if (getGameStatus(state, positionHistory) !== "ongoing") return;
  if (state.turn !== humanColor) requestAiMove();
}

function showPromotionModal(candidates) {
  promotionChoicesEl.innerHTML = "";
  const color = candidates[0].piece.color;

  for (const move of candidates) {
    const btn = document.createElement("button");
    btn.className = "promotion-choice";
    btn.textContent = PIECE_GLYPHS[color][move.promotion];
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

newGameBtn.addEventListener("click", () => {
  gameGeneration += 1; // invalidate any in-flight AI computation
  humanColor = colorSelect.value;
  resetGameState();
  render();
  renderMoveList();
  if (state.turn !== humanColor) requestAiMove();
});

undoBtn.addEventListener("click", () => {
  if (aiThinking || stateHistory.length <= 1) return;
  gameGeneration += 1; // invalidate any in-flight AI computation (defensive; button is disabled while aiThinking)

  do {
    stateHistory.pop();
    positionHistory.pop();
    moveHistory.pop();
  } while (stateHistory.length > 1 && stateHistory[stateHistory.length - 1].turn !== humanColor);

  state = stateHistory[stateHistory.length - 1];
  legalMoves = generateLegalMoves(state);
  selectedSquare = null;
  aiThinking = false;

  render();
  renderMoveList();
});

resetGameState();
render();
renderMoveList();
if (state.turn !== humanColor) requestAiMove();
