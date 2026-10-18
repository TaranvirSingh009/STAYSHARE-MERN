import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const COLS = 18;
const ROWS = 14;
const START_SNAKE = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
const START_DIRECTION = { x: 1, y: 0 };
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
};

const randomFood = (snake) => {
  const empty = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!snake.some((part) => part.x === x && part.y === y)) empty.push({ x, y });
    }
  }
  return empty[Math.floor(Math.random() * empty.length)] || { x: 0, y: 0 };
};

const newGame = () => ({ snake: START_SNAKE.map((part) => ({ ...part })), food: { x: 12, y: 7 }, score: 0, status: "ready" });

export default function NotFound() {
  const [game, setGame] = useState(newGame);
  const direction = useRef(START_DIRECTION);
  const boardRef = useRef(null);

  const steer = useCallback((next) => {
    const current = direction.current;
    if (next.x + current.x === 0 && next.y + current.y === 0) return;
    direction.current = next;
  }, []);

  const restart = () => {
    direction.current = START_DIRECTION;
    setGame({ ...newGame(), status: "playing" });
    requestAnimationFrame(() => boardRef.current?.focus());
  };

  useEffect(() => {
    if (game.status !== "playing") return undefined;
    const onKeyDown = (event) => {
      const next = DIRECTIONS[event.key] || DIRECTIONS[event.key.toLowerCase()];
      if (!next) return;
      event.preventDefault();
      steer(next);
    };
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setInterval(() => {
      setGame((current) => {
        if (current.status !== "playing") return current;
        const vector = direction.current;
        const head = { x: current.snake[0].x + vector.x, y: current.snake[0].y + vector.y };
        const ate = head.x === current.food.x && head.y === current.food.y;
        const collisionBody = ate ? current.snake : current.snake.slice(0, -1);
        const crashed = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || collisionBody.some((part) => part.x === head.x && part.y === head.y);
        if (crashed) return { ...current, status: "over" };
        const snake = [head, ...current.snake.slice(0, ate ? undefined : -1)];
        return { ...current, snake, food: ate ? randomFood(snake) : current.food, score: current.score + (ate ? 1 : 0) };
      });
    }, 145);
    return () => { window.removeEventListener("keydown", onKeyDown); window.clearInterval(timer); };
  }, [game.status, steer]);

  return <section className="not-found-page">
    <span className="auth-eyebrow">404 · Wrong turn</span>
    <h1>This stay isn’t on the map.</h1>
    <p className="muted">That page seems to have wandered off. Fancy a quick game while you find your way back?</p>
    <div className="snake-game">
      <div className="snake-game-top"><strong>StayShare Snake</strong><span>Apples: <b>{game.score}</b></span></div>
      <div ref={boardRef} className="snake-board" tabIndex={0} aria-label="Snake game board. Use arrow keys or WASD to move.">
        {game.status === "ready" && <div className="snake-overlay"><p>Eat apples. Don’t hit the walls or yourself.</p><button className="btn-primary" onClick={restart}>Play Snake</button><small>Arrow keys or WASD · Touch buttons on mobile</small></div>}
        {game.status === "over" && <div className="snake-overlay"><p className="snake-over-title">Game over</p><p>You found {game.score} apple{game.score === 1 ? "" : "s"}.</p><button className="btn-primary" onClick={restart}>Play again</button></div>}
        {game.status === "playing" && <>
          <span className="snake-apple" style={{ gridColumn: game.food.x + 1, gridRow: game.food.y + 1 }} aria-label="Apple">🍎</span>
          {game.snake.map((part, index) => <span key={`${part.x}-${part.y}`} className={`snake-segment ${index === 0 ? "snake-head" : ""}`} style={{ gridColumn: part.x + 1, gridRow: part.y + 1 }} />)}
        </>}
      </div>
      <div className="snake-controls" aria-label="Touch controls">
        <button onClick={() => steer({ x: 0, y: -1 })} aria-label="Move up">↑</button>
        <div><button onClick={() => steer({ x: -1, y: 0 })} aria-label="Move left">←</button><button onClick={() => steer({ x: 0, y: 1 })} aria-label="Move down">↓</button><button onClick={() => steer({ x: 1, y: 0 })} aria-label="Move right">→</button></div>
      </div>
      <p className="snake-help">Use arrow keys or WASD. On a phone, use the direction buttons.</p>
    </div>
    <div className="not-found-links"><Link className="btn-primary" to="/">Back to stays</Link><Link className="btn-outline" to="/help-support">Get help</Link></div>
  </section>;
}
