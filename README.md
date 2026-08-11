# pg-weiqi

**圍棋 9×9**：首刀版圍棋。落子、氣、提子、禁著（自殺禁＋打劫禁）、終局數子。支援**雙人（熱座）**與**對簡易 AI**。棋盤與棋子全以 Canvas 程式繪製，音效為 Web Audio 合成。純前端、零依賴、零 build 步驟。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。

## 一鍵開 SAM 小

```
https://play.samkuo.me/?open=sampot/pg-weiqi&name=圍棋&fresh=1
```

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

點一下頁面後音效才會出聲。

## 操作

| 操作 | 說明 |
| --- | --- |
| 點棋盤交叉點 | 落子（黑先白後） |
| 虛手 | 放棄一手；雙方連下兩手虛手即終局 |
| 數子終局 | 立即進入終局數子（清死子後數空＋子） |
| 切換 雙人／AI | 對局開始前切換模式 |
| 新局 | 重新開局 |
| 音效開／關 | 靜音 |

## 規則

- 9×9 棋盤，黑先白後；落子於交叉點。
- 氣盡被提：無氣之組整組移除並計入對方提子數。
- 禁著：**自殺**（落子後自己無氣）與**打劫**（全盤禁重複局面／ko 一步禁）。
- 終局：雙方連兩手虛手，或按下「數子終局」。
- 數子（台灣／中國規則簡化）：清死子後，黑得分＝黑子數＋黑空數；白得分＝白子數＋白空數＋貼 5.5（KOMI）。分高者勝。
- AI：簡易 AI，隨機合法著手、偏好先吃子。

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 結構 |
| `styles.css` | 亮／暗主題（mobile-first） |
| `app.js` | Canvas 繪製（木紋盤／棋子）＋ 互動 ＋ AI 時序 |
| `game.js` | 純函式規則邏輯（氣、提子、禁著、數子、AI） |
| `game.test.js` | Vitest 單元測試 |
| `audio.js` | Web Audio 合成音效 |
| `functions.js` | Playgrounds stub |
| `assets/` | 空（本作無外部素材） |

## 技術

- 純 HTML＋CSS＋JS，ES module，無依賴、無 build。
- 資料結構：`board[y][x]`，`groupAt` 計算連通組與氣，`removeDeadGroups` 提子，`boardKey` 做局面去重（打劫）。
- 測試：`cd pg-weiqi && npx --yes vitest@latest run`。

## 授權

本 repo 程式碼為 MIT（作者 sampot）。本作無第三方素材；畫與音效皆自繪／合成（見 `ATTRIBUTION.md`）。