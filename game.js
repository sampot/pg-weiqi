/**
 * 圍棋 — 9×9 首刀。純函式規則邏輯（不碰 DOM），可單元測試。
 * 資料結構：board[y][x]，0=空、1=黑、2=白。
 * 規則：落子、氣、提子、禁著（自殺禁＋打劫禁：全盤禁重複局面／ko 一步禁）、終局數子（台灣／中國簡化）。
 */

export const N = 9;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const KOMI = 5.5;

/** 建立 N×N 空棋盤。 */
export function createBoard(size = N) {
  return Array.from({ length: size }, () => Array(size).fill(EMPTY));
}

/** 座標是否在盤內。 */
export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < N && y < N;
}

/** 某格的四個鄰居座標。 */
export function neighbors(x, y) {
  const out = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny)) out.push([nx, ny]);
  }
  return out;
}

/**
 * 計算包含 (x,y) 的連通組：回傳 { stones, liberties, color }。
 * @param {number[][]} board
 */
export function groupAt(board, x, y) {
  const color = board[y][x];
  if (color === EMPTY) return null;
  const stones = [];
  const seen = new Set();
  const stack = [[x, y]];
  seen.add(`${x},${y}`);
  const liberties = new Set();

  while (stack.length) {
    const [cx, cy] = stack.pop();
    stones.push([cx, cy]);
    for (const [nx, ny] of neighbors(cx, cy)) {
      const v = board[ny][nx];
      if (v === EMPTY) liberties.add(`${nx},${ny}`);
      else if (v === color && !seen.has(`${nx},${ny}`)) {
        seen.add(`${nx},${ny}`);
        stack.push([nx, ny]);
      }
    }
  }
  return {
    color,
    stones,
    liberties: [...liberties].map((s) => s.split(",").map(Number)),
  };
}

/** 某組是否有氣。 */
export function hasLiberties(board, x, y) {
  const g = groupAt(board, x, y);
  return g ? g.liberties.length > 0 : false;
}

/**
 * 移除無氣組（提子）。回傳被提的棋子座標。
 * @param {number[][]} board
 */
export function removeDeadGroups(board) {
  const captured = [];
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[0].length; x++) {
      if (board[y][x] === EMPTY) continue;
      if (!hasLiberties(board, x, y)) {
        const g = groupAt(board, x, y);
        for (const [sx, sy] of g.stones) {
          board[sy][sx] = EMPTY;
          captured.push([sx, sy, g.color]);
        }
      }
    }
  }
  return captured;
}

/**
 * 為某組標記無氣（用於數子時清死子）。
 * @param {number[][]} board
 */
export function clearDeadGroups(board) {
  removeDeadGroups(board);
}

/** 深拷貝棋盤。 */
export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

/** 棋盤字串表示（用於禁重複局面）。 */
export function boardKey(board) {
  return board.map((row) => row.join("")).join("/");
}

export class WeiqiGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = createBoard(N);
    this.turn = BLACK;
    this.status = /** @type {'playing' | 'over'} */ ("playing");
    this.captures = { [BLACK]: 0, [WHITE]: 0 };
    this.history = [boardKey(this.board)];
    this.moves = 0;
    this.passCount = 0;
    this.lastMove = null;
    this.winner = null;
    this.result = "";
    this.mode = /** @type {'pvp' | 'vs-ai'} */ ("pvp");
  }

  /** 設定對局模式。 */
  setMode(mode) {
    this.mode = mode;
  }

  opponent(color) {
    return color === BLACK ? WHITE : BLACK;
  }

  /**
   * 檢查 (x,y) 落子是否合法（不落子）。
   * @returns {{ legal: boolean, reason?: string, capturedCount?: number }}
   */
  isLegal(x, y) {
    if (!inBounds(x, y)) return { legal: false, reason: "out-of-bounds" };
    if (this.status !== "playing") return { legal: false, reason: "game-over" };
    if (this.board[y][x] !== EMPTY) return { legal: false, reason: "occupied" };
    const color = this.turn;

    const trial = cloneBoard(this.board);
    trial[y][x] = color;
    const captured = removeDeadGroups(trial);

    // 自殺禁：落子後自己組無氣
    if (!hasLiberties(trial, x, y)) {
      return { legal: false, reason: "suicide" };
    }

    // 打劫禁：ko 一步禁與全盤禁重複局面
    const key = boardKey(trial);
    if (this.history.includes(key)) {
      return { legal: false, reason: "ko" };
    }

    return { legal: true, capturedCount: captured.length };
  }

  /**
   * 落一子。
   * @returns {{ ok: boolean, reason?: string, captured: number[] }}
   */
  play(x, y) {
    const check = this.isLegal(x, y);
    if (!check.legal) return { ok: false, reason: check.reason };

    this.board[y][x] = this.turn;
    const capturedList = removeDeadGroups(this.board);
    const captured = capturedList.filter((c) => c[2] === this.opponent(this.turn));
    this.captures[this.turn] += captured.length;

    this.lastMove = { x, y, color: this.turn };
    this.history.push(boardKey(this.board));
    this.moves += 1;
    this.passCount = 0;

    this.turn = this.opponent(this.turn);
    return { ok: true, captured: captured.map((c) => [c[0], c[1]]) };
  }

  /** 虛手（pass）。連續兩手 pass 終局。 */
  pass() {
    if (this.status !== "playing") return;
    this.passCount += 1;
    this.lastMove = null;
    this.turn = this.opponent(this.turn);
    if (this.passCount >= 2) {
      this.finish();
    }
  }

  /**
   * 終局數子（台灣／中國規則簡化）。
   * 清死子後，黑方得分＝黑子數＋黑空數；白方同理；白貼 5.5（KOMI）。
   * @returns {{ winner: number, black: number, white: number, result: string }}
   */
  score() {
    const board = cloneBoard(this.board);
    removeDeadGroups(board);

    // 對空區域染色：單色圍住 → 給該色；否則為中性
    const areas = this.findAreas(board);
    let blackPoints = 0;
    let whitePoints = 0;

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (board[y][x] === BLACK) blackPoints += 1;
        else if (board[y][x] === WHITE) whitePoints += 1;
      }
    }

    for (const area of areas) {
      const colors = new Set();
      for (const [x, y] of area) {
        for (const [nx, ny] of neighbors(x, y)) {
          if (board[ny][nx] !== EMPTY) colors.add(board[ny][nx]);
        }
      }
      if (colors.size === 1) {
        if (colors.has(BLACK)) blackPoints += area.length;
        else whitePoints += area.length;
      }
    }

    const blackTotal = blackPoints;
    const whiteTotal = whitePoints + KOMI;
    const winner = blackTotal > whiteTotal ? BLACK : whiteTotal > blackTotal ? WHITE : null;
    return {
      winner,
      black: blackPoints,
      white: whitePoints,
      blackTotal,
      whiteTotal,
      result: winner === BLACK ? "黑勝" : winner === WHITE ? "白勝" : "和棋",
    };
  }

  /** 找出所有空區域（連通的空點集合）。 */
  findAreas(board) {
    const visited = new Set();
    const areas = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (board[y][x] !== EMPTY || visited.has(`${x},${y}`)) continue;
        const area = [];
        const stack = [[x, y]];
        visited.add(`${x},${y}`);
        while (stack.length) {
          const [cx, cy] = stack.pop();
          area.push([cx, cy]);
          for (const [nx, ny] of neighbors(cx, cy)) {
            if (board[ny][nx] === EMPTY && !visited.has(`${nx},${ny}`)) {
              visited.add(`${nx},${ny}`);
              stack.push([nx, ny]);
            }
          }
        }
        areas.push(area);
      }
    }
    return areas;
  }

  finish() {
    if (this.status !== "playing") return;
    this.status = "over";
    const s = this.score();
    this.winner = s.winner;
    this.result = s.result;
  }

  /**
   * 簡易 AI：隨機合法著手，偏好先吃子。
   * @returns {{ x: number, y: number } | null}
   */
  aiMove() {
    const candidates = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const check = this.isLegal(x, y);
        if (check.legal) {
          candidates.push({ x, y, captured: check.capturedCount ?? 0 });
        }
      }
    }
    if (!candidates.length) return null;

    // 吃子優先（權重）
    const maxCap = Math.max(...candidates.map((c) => c.captured));
    const preferred = candidates.filter((c) => c.captured >= maxCap);
    return preferred[Math.floor(Math.random() * preferred.length)];
  }
}