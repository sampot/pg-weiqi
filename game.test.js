import { describe, expect, it } from "vitest";
import {
  WeiqiGame,
  createBoard,
  N,
  BLACK,
  WHITE,
  EMPTY,
  KOMI,
  groupAt,
  hasLiberties,
  removeDeadGroups,
} from "./game.js";

describe("board / groupAt", () => {
  it("creates an empty 9x9 board", () => {
    const b = createBoard();
    expect(b).toHaveLength(N);
    expect(b[0]).toHaveLength(N);
    expect(b[4][4]).toBe(EMPTY);
  });

  it("computes a single stone group with four liberties", () => {
    const g = new WeiqiGame();
    g.board[4][4] = BLACK;
    const grp = groupAt(g.board, 4, 4);
    expect(grp.color).toBe(BLACK);
    expect(grp.stones).toHaveLength(1);
    expect(grp.liberties).toHaveLength(4);
    expect(hasLiberties(g.board, 4, 4)).toBe(true);
  });
});

describe("captures", () => {
  it("removes a group with no liberties", () => {
    const g = new WeiqiGame();
    // 白子 4,4 被黑子四面圍住 → 應被提
    g.board[4][4] = WHITE;
    g.board[3][4] = BLACK;
    g.board[5][4] = BLACK;
    g.board[4][3] = BLACK;
    g.board[4][5] = BLACK;
    const captured = removeDeadGroups(g.board);
    expect(g.board[4][4]).toBe(EMPTY);
    expect(captured).toHaveLength(1);
    expect(captured[0][2]).toBe(WHITE);
  });

  it("play() captures a surrounded stone and grants a capture", () => {
    const g = new WeiqiGame();
    // 白子 (4,4) 被黑子三面包圍，黑落第四面 (5,4) 提白。
    g.board[4][4] = WHITE;
    g.board[3][4] = BLACK; // (4,3)
    g.board[5][4] = BLACK; // (4,5)
    g.board[4][3] = BLACK; // (3,4)
    g.turn = BLACK;
    const res = g.play(5, 4);
    expect(res.ok).toBe(true);
    expect(res.captured.length).toBe(1);
    expect(g.board[4][4]).toBe(EMPTY);
    expect(g.captures[BLACK]).toBe(1);
  });
});

describe("legal moves", () => {
  it("rejects occupied cell", () => {
    const g = new WeiqiGame();
    g.board[4][4] = BLACK;
    expect(g.isLegal(4, 4).legal).toBe(false);
  });

  it("rejects out-of-bounds", () => {
    const g = new WeiqiGame();
    expect(g.isLegal(-1, 0).legal).toBe(false);
    expect(g.isLegal(N, N).legal).toBe(false);
  });

  it("rejects suicide (no liberties after placement)", () => {
    const g = new WeiqiGame();
    // 角落三面包圍，黑落角 (0,0)：鄰格 (1,0) 與 (0,1) 皆白無氣 → 自殺
    g.board[0][1] = WHITE; // (1,0)
    g.board[1][0] = WHITE; // (0,1)
    g.turn = BLACK;
    const check = g.isLegal(0, 0);
    expect(check.legal).toBe(false);
    expect(check.reason).toBe("suicide");
  });

  it("ko forbids immediate recapture until a ko threat elsewhere", () => {
    const g = new WeiqiGame();
    // 白 ko 子 (4,4)，黑包圍 (3,4)(5,4)(4,3)，黑外環 (2,4)(6,4)(4,2)。
    g.board[4][4] = WHITE;
    for (const [x, y] of [
      [3, 4],
      [5, 4],
      [4, 3],
      [2, 4],
      [6, 4],
      [4, 2],
    ]) {
      g.board[y][x] = BLACK;
    }
    g.turn = BLACK;
    const cap = g.play(4, 5);
    expect(cap.ok).toBe(true);
    expect(cap.captured.length).toBe(1);
    // 白立即提回 (4,4)：被禁（history 重複 → ko）
    expect(g.isLegal(4, 4).legal).toBe(false);
    // 白在別處落子（劫材）改變盤面後，白提回 (4,4) 合法
    expect(g.turn).toBe(WHITE);
    expect(g.play(7, 7).ok).toBe(true); // white ko threat
    expect(g.isLegal(4, 4).legal).toBe(true);
  });
});

describe("scoring", () => {
  it("empty board score favors white by komi", () => {
    const g = new WeiqiGame();
    const s = g.score();
    expect(s.winner).toBe(WHITE);
    expect(s.whiteTotal).toBeCloseTo(s.white + KOMI);
  });

  it("black territory counts toward black score", () => {
    const g = new WeiqiGame();
    // 黑圍住左上 2x2 矩形
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        g.board[y][x] = BLACK;
      }
    }
    // 圍地內部設為空
    // 用一排黑子框住 2x2 空區
    const s = g.score();
    expect(s.black).toBeGreaterThan(0);
    expect(s.winner).toBe(BLACK);
  });

  it("dead stones are removed before scoring", () => {
    const g = new WeiqiGame();
    // 白子在角落被黑完全包圍 → 數子時清掉
    g.board[0][0] = WHITE;
    g.board[1][0] = BLACK;
    g.board[0][1] = BLACK;
    const s = g.score();
    expect(s.white).toBe(0);
    expect(s.black).toBeGreaterThanOrEqual(2);
  });
});

describe("AI", () => {
  it("AI returns a legal move on an empty board", () => {
    const g = new WeiqiGame();
    const m = g.aiMove();
    expect(m).toBeTruthy();
    expect(g.isLegal(m.x, m.y).legal).toBe(true);
  });

  it("AI plays a capture when available", () => {
    const g = new WeiqiGame();
    // 白子在 (4,4) 被黑子三面包圍，黑 AI 應落在 (5,4) 提白。
    g.board[4][4] = WHITE;
    g.board[3][4] = BLACK; // (4,3)
    g.board[5][4] = BLACK; // (4,5)
    g.board[4][3] = BLACK; // (3,4)
    g.turn = BLACK;
    const m = g.aiMove();
    expect(m).toBeTruthy();
    // AI 優先吃子 → 應落在 (5,4) 提白
    expect(m.x).toBe(5);
    expect(m.y).toBe(4);
  });
});

describe("game flow", () => {
  it("alternates turns after play", () => {
    const g = new WeiqiGame();
    expect(g.play(4, 4).ok).toBe(true);
    expect(g.turn).toBe(WHITE);
    expect(g.play(4, 5).ok).toBe(true);
    expect(g.turn).toBe(BLACK);
  });

  it("two consecutive passes end the game", () => {
    const g = new WeiqiGame();
    g.play(4, 4);
    g.pass();
    g.pass();
    expect(g.status).toBe("over");
    expect(g.winner).not.toBeNull();
  });
});