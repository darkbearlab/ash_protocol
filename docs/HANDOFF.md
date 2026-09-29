# ASH PROTOCOL 現況手冊

3.206.1 起重寫（使用者 2026-09-29：Claude 已經實際接手，給 Codex 交接用的文件不再維護）。舊版手冊的歷史段落在 [archive/handoff-to-3.206.md](archive/handoff-to-3.206.md)。**本檔何時更新**：架構、模組分工、存檔格式、指令或流程改變時。一般版本只寫 CHANGELOG、對應規格與精簡報告。

## 1. 文件地圖

| 要找 | 看這裡 |
| --- | --- |
| 每次開工必讀的規則與不變條件 | [AGENTS.md](../AGENTS.md) |
| 交件前要跑的工具與檢查 | [CHECKLIST.md](CHECKLIST.md) |
| 使用者的排序、待決定事項 | [使用者願望清單.txt](../使用者願望清單.txt) |
| 各系統規格（索引） | [DESIGN.md](DESIGN.md)；核心規則 [CORE_RULES.md](CORE_RULES.md) |
| 每版改了什麼、試玩重點 | [CHANGELOG.md](CHANGELOG.md)（3.190 以前在 archive） |
| 每版的驗證紀錄 | `qa/results/`（3.206.1 起精簡版） |
| 發版與 itch.io 凍結版 | [RELEASE.md](RELEASE.md) |
| 頭目、危險地形、派系 | [BOSSES.md](BOSSES.md)、[HAZARDS.md](HAZARDS.md)、[FACTIONS.md](FACTIONS.md) |
| 故事與管制員 | [STORY.md](STORY.md)；設施紀錄內容在 `content/stories/` |
| 聲音、美術素材的規格（開給 Codex） | [AUDIO.md](AUDIO.md)、[FX_SPRITES_BRIEF.md](FX_SPRITES_BRIEF.md)、[PIXEL_ART.md](PIXEL_ART.md)、`art/` |
| 舊文件原文 | [archive/](archive/README.md) |

## 2. 分工

- **使用者**：設計決定、試玩與手感判斷；明確的決定優先於文件，Claude 把決定記進對應規格。
- **Claude**：規則、數值、介面、文件、測試、發版（推送要使用者同意）。大工作可以交給子代理實作，但一律經獨立審查與 Claude 自己重跑驗證再推送。
- **Codex**：只接素材與音效。Claude 寫規格書（參考 FX_SPRITES_BRIEF.md 的格式：用途、格式、要交的檔、遊戲怎麼畫、交件方式），Codex 交圖或音效與交件說明，Claude 接進遊戲；Codex 不改遊戲程式、不升版、不推送。

## 3. 指令

| 指令 | 用途 |
| --- | --- |
| `npm start` | 開發伺服器 http://localhost:5174（5173 常被別的專案占用）。瀏覽器 QA 一律加 `?test=1` |
| `npm run test:quick` | 開發中的測試，跳過 `qa/slow-tests.txt` 的慢測試，約 1.5 分鐘；可以只給檔名 |
| `npm test` | 完整測試（Node 內建測試器，`tests/*.test.mjs`），約 3.5 分鐘；推送後 GitHub 也會跑 |
| `node qa/save-fuzz.mjs` | 存檔隨機測試，四派系平行，約 1.5 分鐘（選項見檔頭） |
| `node qa/enemy-data-identity.mjs` | 身分基準；`--only`、`--accept`（見 CHECKLIST 第 1 節） |
| `node qa/english-scan.mjs`、`node tools/glossary.mjs --check` | 英文模式、名詞表 |
| `npm run build` | 產生 `dist/`，相容 `/ash_protocol/` |
| `npm run bump -- x.y.z` | 同時改 `package.json`、`src/version.js`、`sw.js` 快取名 |
| `python tools/github-release.py status` | 查 GitHub Pages 部署 |
| `node tools/text-play.mjs` | 文字版遊玩（見 TEXT_PLAY.md） |
| `npm run balance -- 24` | 無畫面遊玩機器人（`tools/balance.mjs`） |

## 4. 模組地圖

純 Node、原生 ES modules，沒有第三方套件。`src/engine.js` 匯出遊戲核心；瀏覽器入口是 `src/main.js` 與 `src/controller.js`。3.206.3～3.206.5 會把 `game.js`、`renderer.js`、`controller.js` 依主題拆開，拆完再更新這一節。

| 主題 | 主要模組 |
| --- | --- |
| 回合與規則核心 | `game.js`（Game 類別、`action` 是唯一回合入口）、`combat.js`、`actor-stats.js`、`traits.js`、`status-timers.js`、`suppression.js` |
| 資料 | `data.js`（武器、敵人卡、`SAVE_VERSION`）、`enemy-data.js`、`characters.js`、`weapons.js`、`ammunition.js`、`factions.js`、`faction-catalog.js` |
| 敵人行為 | `enemy-behavior.js`（`executeEnemyTree`）、`enemy-intents.js`、`enemy-affixes.js`、`tactics.js`、`squad.js`、`orders.js`、`ambush.js`、`flank.js`、`rebels.js`、`swarm*.js`、`pounce.js` |
| 頭目 | `loyalist-bosses.js`、`swarm-bosses.js`、`rebel-bosses.js`、`boss-scenes.js`（出場與擊殺演出） |
| 地圖生成 | `world.js`（`generate`）、`map-*.js`、`pits.js`、`vault.js`、`vent-map.js`、`scenery.js`、`runtime-enemies.js` |
| 危險地形與環境 | `hazard-paths.js`、`fire.js`、`vents.js`、`throwables.js`、`lighting.js`、`flares.js` |
| 友軍 | `allies.js`、`workshop.js`、`pet-growth.js`、`melee-classes.js` |
| 存檔與進度 | `storage.js`、`backup.js`、`progression.js`、`retreat.js`（封存樓層）、`run-log.js`、`replay.js` |
| 畫面 | `renderer.js`、`render.js`、`fx-sprites.js`（煙霧場、火與格柵圖）、`camera.js`、`presentation.js`、`kia.js` |
| 介面與通訊 | `controller.js`、`comms.js`、`comms-events.js`、`target-card.js`、`deploy-ui.js`、`unlock-ui.js` |
| 文字 | `i18n.js`（`t()`）、`text-zh-tw.js`、`text-en.js`、`voices-*.js`、`story-text.js` |
| 擊殺屋與訓練課程 | `killhouse*.js`、`course*.js` |

## 5. 關鍵約定

- 座標 +x 向右、+y 向下；移動只接受曼哈頓距離 1。
- `Game.action(type,arg)` 是唯一的回合入口。無效操作不耗回合、彈藥或物資。先驗證再承諾。
- 行動順序：快速 → 普通 → 緩速；同速時玩家 → 友軍 → 敵人。
- 演出：`captureAction` 記錄 `presentStep` 前後的快照，renderer 播放快照；存檔在演出前寫入；介面不能提前露出結果。
- 亂數狀態跟著存檔。照明、頭像、任務放置、排煙口、火勢等用各自的雜湊，不動戰鬥亂數。
- 存進存檔的 ID 只能附加。新背包的武器欄只到 `CATALOG`（3.203.0），之後加的武器撿到才有欄位。
- 玩家看到的句子一律 `t()` 整句樣板，中英都要有。

## 6. 存檔

- 單局 `ash-save`：`SAVE_VERSION` 見 `src/data.js`。每次升版寫遷移；驗證只擋壞資料，過期的預告在讀檔時丟掉，跟平衡數字有關的值修正到目前上限。
- 往返任務把離開的樓層封存在 `floorStates`（`src/retreat.js` 的 `FLOOR_FIELDS`）；`Game.restore` 用假存檔逐層檢查，新樓層欄位要列預設值。
- 個人紀錄 `ash-profile`：`PROFILE_VERSION` 見 `src/progression.js`；完整備份見 `src/backup.js`。
- 測試模式的鍵一律加 `qa-`；操作紀錄 `ash-run-log` 不在存檔裡。
- 設定（例如「煙霧」`ash-smoke-quality`）存在各自裝置，不進存檔。

## 7. 發版

照 [RELEASE.md](RELEASE.md)：`npm run bump` → CHECKLIST 的交件檢查 → CHANGELOG（最後一行寫試玩重點）與精簡報告 → 只 stage 本批檔案 → 快轉推上 main（使用者同意後，不強推）→ 確認這個 SHA 的 Pages 部署成功。itch.io 凍結版（3.199.x）不動，除非使用者要求。

## 8. 已知限制

- 機器人（`tools/balance.mjs`）不會閃預告、不懂火與煙，頭目與危險地形的難度只能靠使用者試玩。
- 火與噴火器沒有音效；新頭目沿用舊頭目的圖重新上色。
- 真手機上的效能（煙霧場、火、多隻頭目同時在場）還沒量過。
