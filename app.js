import { WeiqiAudio } from "./audio.js";
import {
  WeiqiGame,
  N,
  BLACK,
  WHITE,
} from "./game.js";

const BEST_KEY = "pg-weiqi-best";
const audio = new WeiqiAudio();
const game = new WeiqiGame();
globalThis.__weiqi = game;

const canvas = document.getElementById("board");
const ctx = /** @type {HTMLCanvasElement} */ (canvas).getContext("2d");
const PAD = 20;
const SIZE = 360;
const CELL = (SIZE - PAD * 2) / (N - 1);
canvas.width = SIZE;
canvas.height = SIZE;

const turnEl = document.getElementById("turn");
const modeEl = document.getElementById("mode");
const resultEl = document.getElementById("result");
const btnNew = document.getElementById("btn-new");
const btnPass = document.getElementById("btn-pass");
const btnMode = document.getElementById("btn-mode");
const btnMute = document.getElementById("btn-mute");
const btnScore = document.getElementById("btn-score");
const bestEl = document.getElementById("best");
const capEl = document.getElementById("captures");

let lastTs = 0;
let running = true;
let bestScore = 0;
let bestLoaded = false;
let aiTimer = 0;

function loadBestLocal() {
  const v = Number(localStorage.getItem(BEST_KEY) || "0");
  return Number.isFinite(v) ? v : 0;
}
function saveBestLocal(n) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* ignore */
  }
}

async function loadBestKv() {
  try {
    const res = await fetch(`/api/kv/${BEST_KEY}`);
    if (!res.ok) return;
    const data = await res.json();
    const v = Number(data?.value);
    if (Number.isFinite(v) && v >= 0) bestScore = v;
  } catch {
    /* ignore */
  }
  bestLoaded = true;
  syncHud();
}

async function saveBestKv(n) {
  try {
    await fetch(`/api/kv/${BEST_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: n }),
    });
  } catch {
    /* ignore */
  }
}

function cellXY(e) {
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * SIZE;
  const py = ((e.clientY - rect.top) / rect.height) * SIZE;
  const x = Math.round((px - PAD) / CELL);
  const y = Math.round((py - PAD) / CELL);
  if (x < 0 || y < 0 || x >= N || y >= N) return null;
  return { x, y };
}

function syncHud() {
  const name = game.turn === BLACK ? "黑" : "白";
  turnEl.textContent =
    game.status === "over" ? "終局" : `${name}方落子（${name}子）`;
  capEl.textContent = `黑提 ${game.captures[BLACK]} · 白提 ${game.captures[WHITE]}`;
  modeEl.textContent = game.mode === "vs-ai" ? "對 AI" : "雙人";
  resultEl.textContent = game.status === "over" ? game.result : "";
  bestEl.textContent = String(bestScore);

  btnNew.textContent = game.status === "over" ? "再來一局" : "新局";
  btnPass.disabled = game.status !== "playing";
  btnScore.disabled = game.status !== "playing";
  btnMode.disabled = game.status === "playing";
}

function drawBoard() {
  // 木紋盤
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, "#e6b86a");
  bg.addColorStop(0.5, "#d9a24e");
  bg.addColorStop(1, "#c28a3a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 木紋線
  ctx.strokeStyle = "rgba(120,72,20,0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const y = (i * 37) % SIZE;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SIZE, y + (i % 3) * 8);
    ctx.stroke();
  }

  // 棋盤線
  ctx.strokeStyle = "#5b3a1a";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < N; i++) {
    const p = PAD + i * CELL;
    ctx.beginPath();
    ctx.moveTo(PAD, p);
    ctx.lineTo(SIZE - PAD, p);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p, PAD);
    ctx.lineTo(p, SIZE - PAD);
    ctx.stroke();
  }

  // 星位（9 路星位）
  for (const sy of [2, 6]) {
    for (const sx of [2, 6]) {
      ctx.fillStyle = "#5b3a1a";
      ctx.beginPath();
      ctx.arc(PAD + sx * CELL, PAD + sy * CELL, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 棋子
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = game.board[y][x];
      if (v === 0) continue;
      drawStone(x, y, v);
    }
  }

  // 最後一手標記
  if (game.lastMove) {
    const { x, y } = game.lastMove;
    const cx = PAD + x * CELL;
    const cy = PAD + y * CELL;
    ctx.strokeStyle = game.lastMove.color === BLACK ? "#fff" : "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStone(x, y, color) {
  const cx = PAD + x * CELL;
  const cy = PAD + y * CELL;
  const r = CELL * 0.42;

  ctx.save();
  ctx.translate(cx, cy);

  // 陰影
  ctx.beginPath();
  ctx.ellipse(2, 3, r * 0.95, r * 0.6, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
  if (color === BLACK) {
    body.addColorStop(0, "#4a4a52");
    body.addColorStop(0.5, "#26262e");
    body.addColorStop(1, "#0d0d12");
  } else {
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.7, "#f1ece2");
    body.addColorStop(1, "#c9c2b2");
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = color === BLACK ? "#000" : "#a89f8c";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 高光
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.3, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fill();

  ctx.restore();
}

function tryPlace(x, y) {
  if (game.status !== "playing") return;
  if (game.mode === "vs-ai" && game.turn !== BLACK) return;
  const res = game.play(x, y);
  if (!res.ok) {
    if (res.reason === "occupied") return;
    audio.illegal();
    resultEl.textContent =
      res.reason === "ko" ? "打劫：不得立即提回同一局面" : res.reason === "suicide" ? "禁著：不得自殺落子" : "此處不可落子";
    return;
  }
  audio.stone();
  if (res.captured.length) {
    audio.capture();
    maybeRecordBest();
  }
  resultEl.textContent = "";
  syncHud();
  maybeStartAi();
}

function maybeStartAi() {
  if (game.status === "playing" && game.mode === "vs-ai" && game.turn === WHITE) {
    aiTimer = 0.45;
  }
}

function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000) || 0.016;
  lastTs = ts;

  if (aiTimer > 0) {
    aiTimer -= dt;
    if (aiTimer <= 0 && game.status === "playing" && game.turn === WHITE) {
      const m = game.aiMove();
      if (m) {
        const res = game.play(m.x, m.y);
        if (res.ok) {
          audio.stone();
          if (res.captured.length) audio.capture();
        }
      } else {
        game.pass();
        audio.pass();
      }
      syncHud();
      if (game.status === "over") onGameOver();
    }
  }

  drawBoard();
  syncHud();
  requestAnimationFrame(frame);
}

function onGameOver() {
  audio.over();
  maybeRecordBest();
  const s = game.score();
  resultEl.textContent = `${game.result}（黑 ${s.blackTotal} · 白 ${s.whiteTotal}）`;
}

function maybeRecordBest() {
  // 以總提子數做輕量記錄
  const total = game.captures[BLACK] + game.captures[WHITE];
  if (total > bestScore) {
    bestScore = total;
    saveBestLocal(bestScore);
    void saveBestKv(bestScore);
  }
}

function newGame() {
  game.reset();
  game.setMode(game.mode);
  audio.startBeep();
  resultEl.textContent = "";
  syncHud();
}

btnNew.addEventListener("click", () => newGame());

btnPass.addEventListener("click", () => {
  if (game.status !== "playing") return;
  game.pass();
  audio.pass();
  if (game.status === "over") onGameOver();
  syncHud();
  maybeStartAi();
});

btnScore.addEventListener("click", () => {
  if (game.status !== "playing") return;
  game.finish();
  onGameOver();
  syncHud();
});

btnMode.addEventListener("click", () => {
  game.mode = game.mode === "pvp" ? "vs-ai" : "pvp";
  syncHud();
});

btnMute.addEventListener("click", async () => {
  await audio.unlock();
  audio.setEnabled(!audio.enabled);
  btnMute.textContent = audio.enabled ? "音效開" : "音效關";
  btnMute.setAttribute("aria-pressed", audio.enabled ? "true" : "false");
});

canvas.addEventListener("pointerdown", async (e) => {
  await audio.unlock();
  const p = cellXY(e);
  if (p) tryPlace(p.x, p.y);
});

document.body.addEventListener(
  "pointerdown",
  () => void audio.unlock(),
  { once: true },
);

bestScore = loadBestLocal();
syncHud();
void loadBestKv();
requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(frame);
});