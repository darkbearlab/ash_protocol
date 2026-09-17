# 原色＋外框：已採用，3.122.0 發布

> 2026-09-17 Claude 依本文件於 3.122.0 發布：三張採用快照已換入正式 atlas，快照、來源、製程與雜湊隨版本提交；驗證報告見 `qa/results/2026-09-17-claude-3.122.0-sprite-outline.md`。以下為 Codex 的交接原文。

2026-09-17 使用者確認：「把這版原色加外框的版本存下來，然後告訴 Claude 可以推 GitHub 了」。本輪只封存採用素材與交接，尚未替換正式素材、升版、提交或推送。

## 採用檔案

固定快照在 `art/sprites/adopted/original-outline-2026-09-17/`，不要從試作資料夾挑其他版：

| 採用快照 | 正式替換位置 |
|---|---|
| classes.png | assets/pixel/classes-v1/atlas.png |
| actors.png | assets/pixel/atlas.png |
| dead.png | assets/pixel/aftermath.png |

共八職業與十二組敵人／共用圖，四十個站姿／倒地格。atlas 尺寸、索引與其他物件／特效格不變。原色保留，不採用任何減色版本。透明區補深色外框，不清理原有內側暗色。

狂戰士站姿另有已核准修改：水平 125%，頭頂不動，原 y=2..28 拉為 y=2..30，最近鄰取樣，保留來源色；底部一列預留外框，倒地圖不拉伸。腳底外緣跨度 17 像素，重裝兵 15 像素。角色染色、屍體降彩度、暗房等現行 runtime 效果繼續保留。

`source/` 是本次修改前的三張正式 atlas，`generator.lua` 保存 Aseprite 處理配方，`checksums.json` 是三張採用輸出的 SHA256。切勿直接以已套外框的正式圖重新餵入舊減色腳本，以免重複加框；重製時必須使用此處 source。

## Claude 接手步驟

1. 將以上三張採用快照複製至對應正式位置。路徑沿用，因此無須新增 SW 素材路徑；正常 bump 會刷新快取。
2. 移除 `src/renderer.js` 的 local art audition 區塊（從 `// Local art audition only` 到 `this.aftermathNames` 之前）。這是本機未提交的候選切換工具；不要整檔 checkout，避免覆蓋其他人的改動。
3. 只提交採用快照、來源、製程及必要發布檔。不要 `git add .`；`art/palette-preview/`、`assets/pixel/preview-*`、`qa/sprite-palette-preview.html`、`tmp/` 是本機比較試作，非採用發布內容；自訂頭像及舊 QA 未追蹤檔也不屬於本次。
4. 按 `docs/RELEASE.md` 選下一個可用版本、更新 CHANGELOG／驗證紙條，跑受影響測試及 build，推 main 並確認 Pages。使用者已核准本版素材及由 Claude 推送。

## 驗證狀態

Codex 已跑 13 項 operator-color／actor-visuals／frame-rate 測試通過。先前比較工具 build 通過；最終狂戰士拉伸後只重查像素與範圍，正式替換後仍請跑 build。採用檔案已封存，沒有改規則、存檔或正式 atlas。使用者在本機比較頁確認採用；正式遊戲染色、暗房、倒地與手機體感可在發布後抽查。

