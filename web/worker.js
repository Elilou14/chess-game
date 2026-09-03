/**
 * Runs the AI search off the main thread. "impossible" can block for
 * up to ~5s; without a worker that would freeze the whole page (no
 * repaint, no "thinking" indicator, unresponsive selects) for the
 * duration.
 */
import { chooseAiMove } from "./chess-ai.js";

self.onmessage = (event) => {
  const { state, difficulty, generation } = event.data;
  const move = chooseAiMove(state, difficulty);
  self.postMessage({ move, generation });
};
