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
| `node qa/special-matrix.mjs`、`node qa/save-fuzz.mjs --trace <檔> --against <舊檔>` | 敵人招式對照表；存檔隨機測試的逐步記錄（不改行為的重構用，見 CHECKLIST 第 1 節） |
| `node qa/render-snapshots.mjs --out <檔> [--against <舊檔>]` | 畫面與介面的快照：無頭 Chrome 在測試模式畫固定場景的 canvas 雜湊與重要畫面的 HTML（不改行為地動到 renderer 或 controller 時用，見 CHECKLIST 第 1 節） |
| `node qa/english-scan.mjs`、`node tools/glossary.mjs --check` | 英文模式、名詞表 |
| `npm run build` | 產生 `dist/`，相容 `/ash_protocol/` |
| `npm run bump -- x.y.z` | 同時改 `package.json`、`src/version.js`、`sw.js` 快取名 |
| `python tools/github-release.py status` | 查 GitHub Pages 部署 |
| `node tools/text-play.mjs` | 文字版遊玩（見 TEXT_PLAY.md） |
| `npm run balance -- 24` | 無畫面遊玩機器人（`tools/balance.mjs`） |

## 4. 模組地圖

純 Node、原生 ES modules，沒有第三方套件。`src/engine.js` 匯出遊戲核心；瀏覽器入口是 `src/main.js` 與 `src/controller.js`。

3.206.3 起三個大檔依主題拆成「入口＋主題檔」（行為不變）。找東西先看主題檔；舊規格裡寫 `src/game.js`、`src/renderer.js`、`src/controller.js` 的，指的是整組檔案。

- **Game（`game.js` 與 `game-*.js`）、Renderer（`renderer.js` 與 `renderer-*.js`）**：入口保留類別、建構子與核心；主題檔各是一個類別（`GameActions`、`RendererMap`……），入口用 `src/mixin.js` 的 `mixin()` 把方法、getter 與 static 抄到真正的類別上（不可列舉，和 class 語法一樣；同名重複定義會丟錯）。所以 `this`、`Game.restore`、`Renderer.prototype.x.call(...)` 照舊；新方法放進對應主題檔的類別即可。
- **controller（`controller.js` 與 `controller-*.js`）**：主題檔只有宣告（函式、常數、自己擁有的狀態），不在載入時碰 DOM 或設定；`controller.js` 保留整局的狀態、所有事件監聽、啟動時要跑的程式與測試模式的掛勾，在檔尾一次匯出主題檔要用的東西。匯入的變數是唯讀的：主題檔要改 `controller.js` 的狀態就呼叫它匯出的 `setX()`（例如 `setTitleFlow`、`setDeployDraft`），反過來 `controller.js` 改主題檔的狀態也一樣（`setTerminalDraft`、`setCourseWaiting`）。
- 入口裡標著 `// load order only (3.206.3 split)` 的空 import 保留原本的模組載入順序（有些模組載入時會登錄東西），不要刪。
- 三組檔案的原始碼檢查（測試讀原始碼的部分）用 `tests/helpers/source.mjs` 的 `sourceFamily(name)` 讀整組。

| 主題 | 主要模組 |
| --- | --- |
| 回合與規則核心 | `game.js`（Game 類別：建構子、狀態查詢——視線、通行、門、目標、紀錄）、`game-actions.js`（`validateAction`、`action` 是唯一回合入口、玩家自己的行動、`launchReason` 等可否行動的理由）、`game-attacks.js`（命中率與傷害、開火、發射、錐形、長槍、近戰）、`game-damage.js`（掩護、受傷、敵人掉落、道具與陷阱箱、投擲物與爆炸、玩家與友軍受傷）、`game-enemies.js`（敵人回合、移動與尋路、環境回合）、`game-items.js`（背包、撿取、武器、容器、終端）、`game-floors.js`（產生與載入樓層、下樓、升級）、`game-save.js`（`serialize`、`Game.restore` 的遷移與檢查）；`combat.js`、`actor-stats.js`、`traits.js`、`status-timers.js`、`suppression.js` |
| 資料 | `data.js`（武器、敵人卡、`SAVE_VERSION`）、`enemy-data.js`、`characters.js`、`weapons.js`、`ammunition.js`、`factions.js`、`faction-catalog.js` |
| 敵人行為 | `enemy-behavior.js`（`executeEnemyTree`）、`enemy-intents.js`、`enemy-affixes.js`、`tactics.js`、`squad.js`、`orders.js`、`ambush.js`、`flank.js`、`rebels.js`、`swarm*.js`、`pounce.js` |
| 頭目 | `loyalist-bosses.js`、`swarm-bosses.js`、`rebel-bosses.js`、`boss-scenes.js`（出場與擊殺演出） |
| 敵人招式登錄表（3.206.1） | `enemy-specials.js`：不 import 任何模組；每個預告招式宣告一次（欄位、打斷、回合開頭、誘餌／地雷／危險格／壓制、讀檔修剪與檢查、目標卡），`ORDER` 定所有順序。宣告在擁有招式的模組（`fire.js`、`swarm.js`、`pounce.js`、`swarm-fields.js`、`swarm-bosses.js`、`loyalist-bosses.js`、`rebel-bosses.js`、手榴彈在 `enemy-intents.js`）；`interruptEnemyIntent`、`tickSpecials` 在 `enemy-intents.js`。見 CHECKLIST 第 2 節 |
| 地圖生成 | `world.js`（`generate`）、`map-*.js`、`pits.js`、`vault.js`、`vent-map.js`、`scenery.js`、`runtime-enemies.js` |
| 危險地形與環境 | `hazard-paths.js`、`fire.js`、`vents.js`、`throwables.js`、`lighting.js`、`flares.js` |
| 友軍 | `allies.js`、`workshop.js`、`pet-growth.js`、`melee-classes.js` |
| 存檔與進度 | `storage.js`、`backup.js`、`progression.js`、`retreat.js`（封存樓層）、`run-log.js`、`replay.js` |
| 畫面 | `renderer.js`（Renderer 類別：建構子、畫面迴圈、鏡頭、目標卡位置、`draw` 依序叫各層）、`renderer-map.js`（地板那一層與地上的東西、牆與隔板、門、坑、道具、物品、出口、戰術疊圖、樓層地圖）、`renderer-actors.js`（單位那一層：圖、染色與精英外框、屍體、呼吸、血條）、`renderer-clouds.js`（排煙口、煙霧場兩種品質、燃燒的地板）、`renderer-telegraphs.js`（預告與瞄準：頭目與擲彈兵的預告、瞄準預覽、鎖定框）、`renderer-effects.js`（特效、撤離光束、訊號干擾、喊話泡泡、射程閃爍、最上層）；`render.js`、`fx-sprites.js`（煙霧場、火與格柵圖）、`camera.js`、`presentation.js`、`kia.js` |
| 介面與通訊 | `controller.js`（狀態、事件監聽、`act`、`modal`、開新局與模擬、回放工具、測試掛勾）、`controller-hud.js`（`update`：戰鬥面板、狀態列、目標卡、按鈕；通知）、`controller-comms.js`（通訊列、訓練課程卡、通訊事件、頭目與陣亡演出、結局）、`controller-aim.js`（移動、各種瞄準、開火、互動、技能、手榴彈、道具、鎖定、熱鍵動作）、`controller-deploy.js`（標題與部署畫面、擊殺屋選單）、`controller-screens.js`（紀錄、任務、地圖、解鎖、升級、檔案、手冊、結算）、`controller-pack.js`（背包、工坊、武器比較、補給終端）、`controller-settings.js`（設定分頁、熱鍵、操作台配置、匯出存檔）；`comms.js`、`comms-events.js`、`target-card.js`、`deploy-ui.js`、`unlock-ui.js` |
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
