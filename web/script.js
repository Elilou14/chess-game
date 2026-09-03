import { initialState } from "./chess-logic.js";

const PIECE_GLYPHS = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };

const boardEl = document.getElementById("board");

let state = initialState();
let perspective = "w";

function renderBoard() {
  boardEl.innerHTML = "";
  const rowOrder = perspective === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const colOrder = perspective === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  for (const row of rowOrder) {
    for (const col of colOrder) {
      const square = document.createElement("div");
      const isLight = (row + col) % 2 === 0;
      square.className = `square ${isLight ? "light" : "dark"}`;
      square.dataset.row = String(row);
      square.dataset.col = String(col);

      const piece = state.board[row][col];
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

renderBoard();
