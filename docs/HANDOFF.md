# 快速接手：ASH PROTOCOL（現況手冊）

目前版本 **3.47.0**（最新提交以 `git log origin/main` 為準）。這份手冊只寫現在的樣子。逐版經過看 [CHANGELOG](CHANGELOG.md)；3.44.0 以前的逐版接手段落原文封存在 [archive/handoff-to-3.44.md](archive/handoff-to-3.44.md)。

**本檔何時更新**：架構、模組、存檔格式、發版流程或分工改變時。一般版本只更新 CHANGELOG、對應規格、報告和驗證紙條最新段（見 [RELEASE.md](RELEASE.md)）。

## 文件地圖

| 要找 | 看這裡 |
| --- | --- |
| 使用者目前的排序、觀察清單、待決定事項 | [使用者願望清單.txt](../使用者願望清單.txt) |
| 每版改了什麼 | [CHANGELOG.md](CHANGELOG.md) |
| 各系統規格（索引） | [DESIGN.md](DESIGN.md) |
| 核心規則：命中率、AI、一局流程、武器、戰術數值 | [CORE_RULES.md](CORE_RULES.md) |
| 最新驗收步驟、尚未驗證總表 | [給驗證者的紙條.md](../給驗證者的紙條.md) |
| 每批開發與驗證報告 | `qa/results/` |
| 發版流程 | [RELEASE.md](RELEASE.md) |
| Claude 的授權範圍 | [給Claude的交接.md](../給Claude的交接.md)、[ALLY_ITERATION_SCOPE.md](ALLY_ITERATION_SCOPE.md) |
| 舊的逐版段落（原文） | [archive/](archive/README.md) |

## 分工

- **Codex**：規則層，包括行動承諾、回合與先後手、命中與掩體判定、AI、地圖拓樸、存檔所有權。
- **Claude**（2026-09-10 起）：數值、局內與全域經濟、選單與介面、文件，範圍見〈給Claude的交接〉。另外依 ALLY_ITERATION_SCOPE 迭代工程師、德魯伊、死靈法師的友軍。
- **使用者**：明確決定優先於文件，決定會記在對應規格或授權文件。真手機驗收與自然平衡由使用者判斷；介面可由 Claude 在 `?test=1` 驗證。

## 啟動與測試

1. `npm start`，開 http://localhost:5173。純 Node、原生 ES modules，沒有第三方套件。瀏覽器 QA 一律加 `?test=1`，存檔放在 `qa-` 開頭的鍵，不碰正式任務。
2. `npm test`：Node 內建測試，`tests/*.test.mjs`，3.47.0 為 503 項。
3. `npm run build`：產生 `dist/`，相容 GitHub Pages 的 `/ash_protocol/` 子路徑，推上 main 後自動部署。
4. 模擬腳本（人工場景，不代表自然平衡）：`qa/ally-scenes.mjs`、`qa/pet-waves.mjs`、`qa/drone-waves.mjs`、`qa/necro-waves.mjs`、`qa/grenade-control.mjs`。都可帶 src 目錄參數比較新舊版。`npm run balance -- 24` 是較舊的無畫面遊玩機器人。
5. 場景存檔產生器：`qa/create-*.mjs`，產物在 `qa/fixtures/`（已忽略，不提交）。

## 模組地圖

| 模組 | 用途 |
| --- | --- |
| `src/main.js` | 瀏覽器入口 |
| `src/controller.js` | DOM、觸控、鍵盤、所有對話框（背包、終端、設定、說明、戰鬥紀錄）、HUD、演出播放、存檔時機 |
| `src/engine.js` | 穩定匯出入口，UI、測試、工具共用 |
| `src/game.js` | `Game` 類別：行動驗證與結算、敵人 AI、爆炸、背包、樓層切換、存檔序列化與遷移 |
| `src/data.js` | 內容與數值：武器、敵人、樓層、升級、資料片段；`SAVE_VERSION`、`LEGACY_SAVE_VERSIONS` |
| `src/world.js` | 亂數、視線、地圖生成、敵人建立 |
| `src/combat.js`、`src/cover.js` | 敵我共用的牆角探身、掩護、命中率；掩體角度效率 |
| `src/traits.js`、`src/actor-stats.js` | 被動規則與行動順序（`initiativeQueue`）；命中／迴避修正通道 |
| `src/characters.js`、`src/skills.js` | 職業與起始配給；主動技能定義與狀態 |
| `src/allies.js` | 友軍：機體、寵物、召喚物的建立、行動、繩索、換位、友軍技能 |
| `src/throwables.js`、`src/lighting.js` | 投擲物、失能與免疫、煙霧視線；照明與暗區 |
| `src/barriers.js`、`src/containers.js`、`src/modules.js` | 門與隔板；補給箱；生活模組與補給站 |
| `src/missions.js`、`src/retreat.js` | 任務合約與目標；三層往返的樓層保存與增援 |
| `src/weapons.js`、`src/ammunition.js`、`src/prepared.js` | 武器詞條；彈種、攜帶上限、永久攜行價格；背包預備欄 |
| `src/progression.js`、`src/storage.js`、`src/backup.js` | 協定點數與個人紀錄（`PROFILE_VERSION`）；本機存檔、QA 隔離、讀前備份、還原；完整備份 |
| `src/perks.js` | 局內升級獨立抽選、階數、效果與舊檔遷移；詳見 [PERKS.md](PERKS.md) |
| `src/daily.js`、`src/version.js` | 每日任務種子；遊戲版本（唯一來源） |
| `src/presentation.js` | 回合演出：快照與時序 |
| `src/renderer.js`、`src/render.js`、`src/camera.js` | Canvas 繪製、點擊座標、特效；鏡頭取景 |
| `src/target-card.js`、`src/layout.js`、`src/movement-boundaries.js` | 目標資訊卡；直向判斷；移動邊界白線 |
| `src/walls.js`、`src/themes.js`、`src/materials.js`、`src/material-selection.js`、`src/art-tone.js`、`src/traces.js`、`src/portraits.js` | 牆、房間主題、素材選用、色調、戰鬥痕跡、隨局頭像（純外觀，不影響規則與戰鬥亂數） |
| `src/audio.js`、`src/material-review.js` | 合成音效；選材頁（`material-review.html`） |
| `index.html`、`style.css`、`expansion.css` | 頁面與樣式 |
| `sw.js` | 離線快取；新增 `src/` 模組要加進 `FILES`（測試會擋） |
| `tools/build.mjs`、`tools/bump-version.mjs`、`tools/github-release.py`、`tools/balance.mjs` | 建置；改版本號；查部署；無畫面遊玩機器人 |
| `server.mjs` | 本機靜態伺服器 |

## 關鍵約定

- 座標 +x 向右、+y 向下；移動只接受曼哈頓距離 1。
- `Game.action(type,arg)` 是唯一的回合入口。無效操作不耗回合、彈藥或物資。先驗證再承諾，輪到時重新確認；結算時失效就照付回合、不產生效果。
- 行動順序：快速 → 普通 → 緩速；同速時玩家 → 友軍 → 敵人，每個單位每回合一次。失能與免疫依自己的行動機會扣除。
- 演出：`captureAction` 記錄 `presentStep` 前後的快照，renderer 播放快照；存檔在演出前寫入。介面讀演出中的狀態，不能提前露出死亡、升級或結果。
- 亂數狀態跟著存檔，讀檔不重擲。照明、頭像、任務放置用各自的亂數，不動戰鬥亂數。
- 存進存檔的內容 ID（武器索引、角色、道具、任務）只能附加，不能重排。
- 介面不直接改生命、彈藥、廢料、回合，一律走 `Game.action` 或 storage API。
- 預備投擲物、道具、技能免費；使用才耗回合。
- 說明文字的數字盡量讀常數（3.44 起技能、投擲物、說明頁已改）。

## 存檔與版本

- 單局 `ash-save`：save **v29**（`data.js` 的 `SAVE_VERSION`）。舊版 1～28 都能讀（`LEGACY_SAVE_VERSIONS` 自動推算），讀取前先存 `ash-save-v{N}-backup`。
- 個人紀錄 `ash-profile`：profile **v4**（`progression.js` 的 `PROFILE_VERSION`）；完整備份外層 v1（`backup.js`）。
- 匯入前存 `ash-save-before-import`；還原前存 `ash-backup-before-restore` 與 `ash-restore-journal`。QA 模式所有鍵加 `qa-`。
- 規則：一般介面改動不升存檔版本。改資料格式才升版，而且要寫遷移、保留原件、加測試；新欄位要在驗證與備份往返中都保留。
- `saveGame()` 回傳是否寫入成功；失敗時介面顯示「⚠ 未存檔」。
- 遊戲版本在 `src/version.js`，用 `npm run bump -- x.y.z` 一次改齊；`tests/release.test.mjs` 檢查一致。

## 發版

依 [RELEASE.md](RELEASE.md)：改版本號 → `npm test`、`npm run build` → 更新 CHANGELOG、規格、報告、紙條最新段 → 只 stage 本批檔案 → 推上 main（不強推）→ 確認這個 SHA 的 Pages run 成功 → 報告補發布紀錄。

## 近期重點（3.36～3.45.0）

- **3.45.0** 通用升級十一項，永久三階、資源無限；獨立隨機、60% 已選優先名額、保存當次選項、引擎驗證。save v28；職業專屬與主選單升級另議。

- **3.36～3.41 三職業友軍**：
  - 3.36 走不到改走最近、交戰不折返。
  - 3.37 寵物倒地回收、收納回血。
  - 3.38 玩家與友軍換位，取代推動。
  - 3.39 機體 90 HP、改用步槍、自己換彈、30 廢料生產新機。
  - 3.40 死靈召喚物自動起身，技能改為集結。
  - 3.41 追隨機體貼身、部署時自選落點。

  規格見 [ALLIES.md](ALLIES.md)。
- **3.42** 震撼彈／EMP 跳過 4 次，頭目 2 次。見 [THROWABLES.md](THROWABLES.md)。
- **3.43.0** 左上護甲條、低血量紅光。**3.43.1** 召喚池排除機械。
- **3.44.0** 盤點後修正：
  - 直向鎖定改看主要輸入方式。
  - 存檔失敗提示。
  - 存檔版本推算。
  - 每日種子加鹽。
  - 戰鬥紀錄。
  - 說明文字對帳。
- **3.44.1** 版本號單一來源，文件整理（本手冊、規格索引、封存）。

## 已知限制

觀察中的項目見願望清單「觀察中」，尚未驗證的項目見驗證紙條「尚未驗證總表」。從來沒有在真手機上驗證過；所有瀏覽器檢查都是 Chromium 模擬。

3.46 平衡補充：重裝兵／死靈法師「難以治療」，既有局載入補唯一角色來源，save v28 不變。新增生命恢復入口請走 traits.js 的 healActor，計入升級加成後再減半；詳見 TRAITS.md。

3.47：狂戰士與忍者的規則已完成，介面留Claude。新增 src/melee-classes.js 管理鉤鎖、戰意、嗜血、刃藏、伏擊與特殊迴避；skillState 支援效果結束後才倒冷卻。save v29補battleSpirit，舊資料保留。詳見 MELEE_CLASSES.md 與本輪報告。

3.47.1（Claude）接上介面：選角、鉤鎖落點預覽與按鈕文字、狀態列、目標卡、背包標題、說明文字。顯示邏輯放在 src/melee-ui.js，測試在 tests/melee-ui.test.mjs。被動說明的數字是字面值（traits.js 不能匯入 melee-classes.js，會循環），調整 MELEE_TUNING 時要一起改，測試會擋。
