/**
 * Pure chess rules engine -- no I/O, no globals, no mutation of its
 * inputs. Every function takes a state (or board) in and returns new
 * data out, which is what makes it testable with plain node:test.
 * A direct port of python/chess_logic.py -- see that file for the
 * fuller design notes; kept in sync function-for-function.
 *
 * Board layout: an 8x8 array of arrays. Row 0 is rank 8 (Black's back
 * rank), row 7 is rank 1 (White's back rank). Column 0 is file 'a',
 * column 7 is file 'h'. An empty square is null; an occupied square
 * is { type: "P"|"N"|"B"|"R"|"Q"|"K", color: "w"|"b" }.
 */

export const PROMOTION_TYPES = ["Q", "R", "B", "N"];

const BACK_RANK = ["R", "N", "B", "Q", "K", "B", "N", "R"];

export function oppositeColor(color) {
  return color === "w" ? "b" : "w";
}

export function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function squareToRc(square) {
  const col = square.charCodeAt(0) - "a".charCodeAt(0);
  const row = 8 - Number(square[1]);
  return [row, col];
}

export function rcToSquare(row, col) {
  const fileChar = String.fromCharCode("a".charCodeAt(0) + col);
  const rankChar = String(8 - row);
  return `${fileChar}${rankChar}`;
}

export function copyBoard(board) {
  return board.map((row) => row.slice());
}

export function initialState() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: BACK_RANK[col], color: "b" };
    board[1][col] = { type: "P", color: "b" };
    board[6][col] = { type: "P", color: "w" };
    board[7][col] = { type: BACK_RANK[col], color: "w" };
  }

  return {
    board,
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
  };
}

const FEN_PIECE_MAP = { p: "P", n: "N", b: "B", r: "R", q: "Q", k: "K" };

/** Parse a FEN string into a state -- used to set up known test positions. */
export function loadFen(fen) {
  const [boardPart, turn, castlingPart, enPassantPart, halfmoveStr, fullmoveStr] = fen.split(" ");

  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  boardPart.split("/").forEach((rankStr, row) => {
    let col = 0;
    for (const char of rankStr) {
      if (/\d/.test(char)) {
        col += Number(char);
      } else {
        const color = char === char.toUpperCase() ? "w" : "b";
        board[row][col] = { type: FEN_PIECE_MAP[char.toLowerCase()], color };
        col += 1;
      }
    }
  });

  const castling = {
    wK: castlingPart.includes("K"),
    wQ: castlingPart.includes("Q"),
    bK: castlingPart.includes("k"),
    bQ: castlingPart.includes("q"),
  };
  const enPassant = enPassantPart === "-" ? null : squareToRc(enPassantPart);

  return {
    board,
    turn,
    castling,
    enPassant,
    halfmoveClock: halfmoveStr !== undefined ? Number(halfmoveStr) : 0,
    fullmoveNumber: fullmoveStr !== undefined ? Number(fullmoveStr) : 1,
  };
}

export function makeMove(from, to, piece, options = {}) {
  return {
    from,
    to,
    piece,
    captured: options.captured ?? null,
    promotion: options.promotion ?? null,
    isEnPassant: options.isEnPassant ?? false,
    castle: options.castle ?? null,
  };
}

function slideMoves(board, row, col, piece, deltas) {
  const moves = [];
  const color = piece.color;
  for (const [dRow, dCol] of deltas) {
    let r = row + dRow;
    let c = col + dCol;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (target === null) {
        moves.push(makeMove([row, col], [r, c], piece));
      } else if (target.color !== color) {
        moves.push(makeMove([row, col], [r, c], piece, { captured: target }));
        break;
      } else {
        break;
      }
      r += dRow;
      c += dCol;
    }
  }
  return moves;
}

function stepMoves(board, row, col, piece, deltas) {
  const moves = [];
  const color = piece.color;
  for (const [dRow, dCol] of deltas) {
    const r = row + dRow;
    const c = col + dCol;
    if (!inBounds(r, c)) continue;
    const target = board[r][c];
    if (target === null) {
      moves.push(makeMove([row, col], [r, c], piece));
    } else if (target.color !== color) {
      moves.push(makeMove([row, col], [r, c], piece, { captured: target }));
    }
  }
  return moves;
}

function pawnMoves(board, row, col, piece) {
  const moves = [];
  const color = piece.color;
  const direction = color === "w" ? -1 : 1;
  const startRow = color === "w" ? 6 : 1;
  const promotionRow = color === "w" ? 0 : 7;

  const addForwardOrCapture = (r, c, captured) => {
    if (r === promotionRow) {
      for (const promo of PROMOTION_TYPES) {
        moves.push(makeMove([row, col], [r, c], piece, { captured, promotion: promo }));
      }
    } else {
      moves.push(makeMove([row, col], [r, c], piece, { captured }));
    }
  };

  const oneRow = row + direction;
  if (inBounds(oneRow, col) && board[oneRow][col] === null) {
    addForwardOrCapture(oneRow, col, null);
    const twoRow = row + 2 * direction;
    if (row === startRow && board[twoRow][col] === null) {
      moves.push(makeMove([row, col], [twoRow, col], piece));
    }
  }

  for (const dCol of [-1, 1]) {
    const r = row + direction;
    const c = col + dCol;
    if (!inBounds(r, c)) continue;
    const target = board[r][c];
    if (target !== null && target.color !== color) {
      addForwardOrCapture(r, c, target);
    }
  }

  return moves;
}

const KNIGHT_DELTAS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const BISHOP_DELTAS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DELTAS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const QUEEN_DELTAS = [...BISHOP_DELTAS, ...ROOK_DELTAS];
const KING_DELTAS = QUEEN_DELTAS;

/**
 * All moves for the side to move that follow each piece's movement
 * pattern, WITHOUT checking whether the move leaves that side's own
 * king in check. Does not include castling or en passant capture --
 * see chess-special.js.
 */
export function generatePseudoLegalMoves(state) {
  const { board, turn: color } = state;
  const moves = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece === null || piece.color !== color) continue;

      if (piece.type === "P") moves.push(...pawnMoves(board, row, col, piece));
      else if (piece.type === "N") moves.push(...stepMoves(board, row, col, piece, KNIGHT_DELTAS));
      else if (piece.type === "B") moves.push(...slideMoves(board, row, col, piece, BISHOP_DELTAS));
      else if (piece.type === "R") moves.push(...slideMoves(board, row, col, piece, ROOK_DELTAS));
      else if (piece.type === "Q") moves.push(...slideMoves(board, row, col, piece, QUEEN_DELTAS));
      else if (piece.type === "K") moves.push(...stepMoves(board, row, col, piece, KING_DELTAS));
    }
  }

  return moves;
}

function updateCastlingRights(castling, piece, from, captured, to) {
  const next = { ...castling };
  const color = piece.color;

  if (piece.type === "K") {
    next[`${color}K`] = false;
    next[`${color}Q`] = false;
  } else if (piece.type === "R") {
    const homeRow = color === "w" ? 7 : 0;
    if (from[0] === homeRow && from[1] === 0) next[`${color}Q`] = false;
    else if (from[0] === homeRow && from[1] === 7) next[`${color}K`] = false;
  }

  if (captured !== null && captured.type === "R") {
    const enemy = oppositeColor(color);
    const homeRow = enemy === "w" ? 7 : 0;
    if (to[0] === homeRow && to[1] === 0) next[`${enemy}Q`] = false;
    else if (to[0] === homeRow && to[1] === 7) next[`${enemy}K`] = false;
  }

  return next;
}

/**
 * Pure: returns a new state with `move` applied. Does not mutate
 * `state`. Executes castling (also relocates the rook) and en
 * passant (removes the pawn beside the destination square) when the
 * move is flagged that way.
 */
export function applyMove(state, move) {
  const board = copyBoard(state.board);
  const [fromRow, fromCol] = move.from;
  const [toRow, toCol] = move.to;
  const piece = move.piece;

  board[fromRow][fromCol] = null;

  if (move.isEnPassant) {
    board[fromRow][toCol] = null;
  }

  const placed = move.promotion ? { type: move.promotion, color: piece.color } : piece;
  board[toRow][toCol] = placed;

  if (move.castle) {
    const homeRow = fromRow;
    const [rookFromCol, rookToCol] = move.castle === "K" ? [7, 5] : [0, 3];
    const rook = board[homeRow][rookFromCol];
    board[homeRow][rookFromCol] = null;
    board[homeRow][rookToCol] = rook;
  }

  const isPawnMove = piece.type === "P";
  const isCapture = move.captured !== null;
  const halfmoveClock = isPawnMove || isCapture ? 0 : state.halfmoveClock + 1;

  const fullmoveNumber = state.fullmoveNumber + (state.turn === "b" ? 1 : 0);

  let enPassant = null;
  if (isPawnMove && Math.abs(toRow - fromRow) === 2) {
    enPassant = [(fromRow + toRow) / 2, fromCol];
  }

  const castling = updateCastlingRights(state.castling, piece, move.from, move.captured, move.to);

  return {
    board,
    turn: oppositeColor(state.turn),
    castling,
    enPassant,
    halfmoveClock,
    fullmoveNumber,
  };
}
