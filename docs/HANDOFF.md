# 快速接手：ASH PROTOCOL（現況手冊）

目前版本 **3.113.0**（職業技能不再能用學習資料學，SAVE 55，Claude；3.112.0 為霰彈槍錐形射擊；3.111.0 為精準步槍要瞄準、榴彈發射器改打地板；3.110.1 為彈藥砍到三分之一；3.110.0 為器材箱；3.109.0 為摺疊掩體；3.108.0 為佩戴型道具與夜視鏡；3.107.0 為消耗品可直接從背包使用；3.106.0 為修復噴劑與腎上腺素；3.105.0 為顯形距離；3.104.0 為訊息列併進標題列與假呼吸；3.103.1 為忠誠者與叛軍分開命名；3.103.0 為投放詞條與敵方浮游彈藥；3.102.0 為按鈕位置可自訂；3.101.0 為格狀操作區；3.100.1 為武器比較的「收進空格」移到上排；3.100.0 為叛軍詭雷箱，SAVE 51；3.99.0 為 KILL HOUSE 整備層放 100 廢料；3.98.1 為移除右上角的 ×、禁止縮放、標題與結算改回整頁；3.98.0 為操作區排版與方向鍵大小設定；3.97.3 為升級三選一改貼畫面上緣；3.97.2 為選單底部抽屜；3.97.1 為手機介面修正；3.97.0 為手機介面；3.96.0 為工坊第 6 階段修理；3.95.0 為工坊第 5 階段頭目藍圖；3.94.0 為工坊第 4 階段敵方藍圖；3.93.0 為工坊第 3 階段武器掛載；3.92.1 為浮游彈藥不再避開玩家；3.92.0 為工坊第 2 階段浮游彈藥；3.91.0 為第 1 階段；3.90.0 解鎖規則由 Codex 實作、Claude 代為提交，3.90.1 為 Claude 的解鎖介面與複查修正）（最新提交以 `git log origin/main` 為準）。這份手冊只寫現在的樣子。逐版經過看 [CHANGELOG](CHANGELOG.md)；3.44.0 以前的逐版接手段落原文封存在 [archive/handoff-to-3.44.md](archive/handoff-to-3.44.md)。

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
- **2026-09-15 起（Codex 暫停）**：使用者決定先假設一段時間無法使用 Codex。規則層、發布與推送改由 Claude 決定並維護，設計以 Claude 能維護為主。Claude 在原 Codex 範圍的變更記在對應規格（例如 UNLOCKS 第 13 節），Codex 回來後複查。
- **使用者**：明確決定優先於文件，決定會記在對應規格或授權文件。真手機驗收與自然平衡由使用者判斷；介面可由 Claude 在 `?test=1` 驗證。

## 啟動與測試

1. `npm start`，開 http://localhost:5173。純 Node、原生 ES modules，沒有第三方套件。瀏覽器 QA 一律加 `?test=1`，存檔放在 `qa-` 開頭的鍵，不碰正式任務。
2. `npm test`：Node 內建測試，`tests/*.test.mjs`，3.70.0 為 629 項（職業強化的既有驗證範圍見下方 3.60 段）。
3. `npm run recipes`：驗證 maps/recipes/*.json 並編譯靜態配方池；start／build 自動執行。
4. `npm run build`：產生 `dist/`，相容 GitHub Pages 的 `/ash_protocol/` 子路徑，推上 main 後自動部署。
5. 模擬腳本（人工場景，不代表自然平衡）：`qa/ally-scenes.mjs`、`qa/pet-waves.mjs`、`qa/drone-waves.mjs`、`qa/necro-waves.mjs`、`qa/grenade-control.mjs`。都可帶 src 目錄參數比較新舊版。`npm run balance -- 24` 是較舊的無畫面遊玩機器人。
6. 場景存檔產生器：`qa/create-*.mjs`，產物在 `qa/fixtures/`（已忽略，不提交）。

## 模組地圖

| 模組 | 用途 |
| --- | --- |
| src/corner.js、src/tactics.js | 轉角暴露射線／UI 查詢、共用敵我交戰位置與有限繞路；見 CORNER_TACTICS.md |
| `src/class-perks.js` | 職業強化每階常數與階數讀取；由既有 player.perks 推導，第一批為重裝兵／狂戰士 |
| `src/actor-visuals.js` | 演出專用移動插值（120ms）、暗房精靈快取（55% RGB）；不寫入存檔 |
| `src/main.js` | 瀏覽器入口 |
| `src/controller.js` | DOM、觸控、鍵盤、所有對話框（背包、終端、設定、說明、戰鬥紀錄）、HUD、演出播放、存檔時機 |
| `src/engine.js` | 穩定匯出入口，UI、測試、工具共用 |
| `src/enemy-affixes.js`、`src/enemy-behavior.js`、`src/behavior-tree.js`、`src/enemy-intents.js` | 詞條出生／顯現、共用與單位行為樹、預告打斷、擲彈 marks；ENEMY_AFFIXES 第 8、9 節 |
| `src/game.js` | `Game` 類別：行動驗證與結算、敵人 AI、爆炸、背包、樓層切換、存檔序列化與遷移 |
| `src/data.js` | 內容與數值：武器、敵人、樓層、升級、資料片段；`SAVE_VERSION`、`LEGACY_SAVE_VERSIONS` |
| `src/enemy-data.js` | 敵人分類／起始被動查詢、順序固定的出生表、友軍借用底型；規則定義在 data.js，外觀解耦留 Claude，見 ENEMY_DATA 第 9 節 |
| `src/world.js` | 亂數、視線、生成流程、敵人建立；generate 預設 v2 第六階段加執行期內容，generateWithRecipes(..., []) 保留 v1 |
| `src/map-recipes.js`、`src/map-recipes-data.js` | 第六階段 JSON 格式／權重抽選與編譯池；maps/recipes/README.md 說明使用方法，世代 7 保存配方副本 |
| `src/map-slots.js` | 第五階段：槽位／任務預留、油桶重排、大房間模組與空貨櫃；完整回退，世代 6 |
| `src/scenery.js`、`src/barrier-art.js` | 分段車輛／家具定義與實體遮擋、隔板半格高投影／接柱及雙軸門框；素材與製程見 art/scenery-v1、art/doors-v1 |
| `src/map-annexes.js` | 第四階段：實算外圈寬度、附屬區／兩口／矮欄杆、母房照明與安全回退；世代 5 包含下層描述，見 MAPGEN 第 16 節 |
| `src/map-openings.js` | 第三階段：界面、連接口區域／通路、間距、配方開口數與門比例；完整回退，世代 4 |
| `src/map-merging.js` | 第二階段內建合併候選、整組複製與回退；重排圖形、哨位、中央掩體、隔間／矮隔板、補給站及光照 |
| `src/map-geometry.js`、`src/map-population.js` | 格位／房間／輪廓與可選存檔欄位；威脅分配、任務名額保障、哨位與 expendable 資格 |
| `src/combat.js`、`src/cover.js` | 敵我共用的牆角探身、掩護、命中率；掩體角度效率 |
| `src/traits.js`、`src/actor-stats.js` | 被動規則與行動順序（`initiativeQueue`）；命中／迴避修正通道 |
| `src/characters.js`、`src/skills.js` | 職業與起始配給；主動技能定義與狀態 |
| `src/allies.js` | 友軍：機體、寵物、召喚物的建立、行動、繩索、換位、友軍技能 |
| `src/workshop.js` | 工程師工坊：藍圖、生產序列、部署、浮游彈藥、武器掛載與掉落、v46 存檔遷移；見 ENGINEER.md |
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
| `src/class-art.js`、`src/operator-color.js` | 八職業灰色精靈座標；塗裝顏色與套色（本機顯示設定，不進存檔） |
| `src/melee-classes.js`、`src/melee-ui.js` | 狂戰士／忍者規則（鉤鎖、戰意、嗜血、刃藏、伏擊、單挑、迷彩閃避）；它們的介面文字與狀態顯示 |
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

- 單局 `ash-save`：save **v50**（`data.js` 的 `SAVE_VERSION`）。舊版 1～49 都能讀（`LEGACY_SAVE_VERSIONS` 自動推算），讀取前先存 `ash-save-v{N}-backup`。
- 個人紀錄 `ash-profile`：profile **v7**（`progression.js` 的 `PROFILE_VERSION`）；完整備份外層 v1（`backup.js`）。
- 匯入前存 `ash-save-before-import`；還原前存 `ash-backup-before-restore` 與 `ash-restore-journal`。QA 模式所有鍵加 `qa-`。
- 規則：一般介面改動不升存檔版本。改資料格式才升版，而且要寫遷移、保留原件、加測試；新欄位要在驗證與備份往返中都保留。
- `saveGame()` 回傳是否寫入成功；失敗時介面顯示「⚠ 未存檔」。
- 遊戲版本在 `src/version.js`，用 `npm run bump -- x.y.z` 一次改齊；`tests/release.test.mjs` 檢查一致。

## 發版

依 [RELEASE.md](RELEASE.md)：遊戲改動：改版本號 → 依風險執行測試與 build（完整 CI 必須通過）→ 更新 CHANGELOG、規格、報告、紙條最新段 → 只 stage 本批檔案 → 推上 main（不強推）→ 確認這個 SHA 的 Pages run 成功 → 報告補發布紀錄。

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

3.48：玩家八職業有獨立灰色站姿／死亡圖集。`src/class-art.js` 提供座標，renderer.classSprite 使用演出快照的職業。來源與製程見 `art/classes-v1/README.md`；其他單位仍用既有圖集。

3.49：等級20截止三選一，21起自動封頂補給；無盡任務與六層設定循環、深層敵人成長。src/endless.js集中常數；data.floorInfo共用樓層設定。save30保留歷史超限強化，profile5新增endless.best/byCharacter，備份外層1不變。詳見ENDLESS.md；Claude接UI與平衡。

3.57.0：save v31 新增 classPerkMisses（0～2），職業選單保底計數；舊檔遷移 0、待選卡保留。完整備份沿用原封裝。

3.50～3.52（Claude 介面與經濟）：地上的武器可就地拆解；精靈圖跟著地圖等比縮放（`spriteSize` 在 src/target-card.js，渲染與遮蔽共用）；背包版面緊湊化並依彈種上色；局內升級新增「裝甲回收」（`plateDrop` 在 src/perks.js）；等級數字停在 20 顯示 MAX，之後每 22 經驗發一份封頂補給。無盡介面文字集中在 src/endless-ui.js。

3.54（Claude 介面）：背包、樓層地圖、☰ 選單右上加關閉鈕（`modal(html,wide,title,closable)` 依內容是否含 `data-modal="close"` 自動判定，升級三選一維持必選）；撞隔板不再搶走敵人鎖定；「永久攜行升級」只留在主選單，結算與 ☰ 都移除。

3.55～3.60：八職業各三項局內升級全部進池，save v31 的 `classPerkMisses`（抽選保底）與 save v32 的 `shadowSteps`（忍者影步）。規格見 CLASS_PERKS.md。**Codex 這批沒有附自動測試**，Claude 的程式驗證（22 項獨立檢查全過）在 `qa/results/2026-09-12-claude-3.60-class-perks-qa.md`，同檔記了兩個介面缺口：影步剩餘步數沒進狀態列、技能說明仍顯示基礎值。

道具：2026-09-12 定案的設計紀錄在 [ITEMS.md](ITEMS.md)（消耗／佩戴／任務型、現成鉤子、成本分級）。尚未開工；開工時要一次規劃存檔欄位，不要一項升一次版本。

## 地圖骨架 v2（3.61.0 起）

- 第 1 階段完成；`docs/MAPGEN.md` 第 13 節是實作現況與後續邊界。
- `cells` 指向房間 ID，`rooms` 保留包圍矩形並帶 `cellIds/footprint`。範圍查詢使用 `roomContains/roomTiles/roomAt`，舊檔仍可用矩形。
- `openings` 描述生成時的通道，`barrierIds` 是歷史關聯，不是現在門的通行狀態；現在通行一律讀 grid/barriers。第 1 階段沿用原門規則，第 3 階段才套無門通道保障。
- `MAP_FIELDS` 納入 `FLOOR_FIELDS`，但屬可選欄位；`REQUIRED_FLOOR_FIELDS` 保持既有必填。返回舊樓層時要清掉現層描述，不能 Object.assign 後殘留。
- save v32 不升版：缺少 v2 描述不重生；存在則驗證。每次改生成結果要遞增生成世代，並保留既有世代的讀取支援。
- 單局全域的 `mapGenerations` 記所有經歷過的世代（例如 `[1,2]`），結算複製到 history。同一個每日種子跨世代不能直接比較；部署種類／日期目前沒有獨立保存，因此這個欄位適用所有局，UI 由 Claude 接上。
- 手工 QA 若換掉 rooms，應一併移除 cells/openings/annexes/generation/slots；測試共用 `tests/helpers/arena.mjs`，不要放寬正式存檔驗證。
- 原有勝率回歸固定使用 LegacyGame；v2 機器人另驗行動合法與結束，3.61.0 觀察到 Recon 種子 1～12 無勝局。這是待人工檢視的難度變化，沒有調整武器、敵人數值或放寬 v1 勝率斷言。


### 3.69 執行期批次

`runtime-enemies.js`：新圖雜兵／巢穴、共享 64 活敵人上限、6 雜兵上限、巢穴驗證。`unarmed.js`：虛擬徒手。save v33 的 `pursuit` 是全局行動狀態，舊檔補 0；巢穴狀態與子代在原 props／enemies 保存，FLOOR_FIELDS 已涵蓋。免費追擊不進佇列、不推進任何時鐘；攻擊目標不限。傷害來源必須明確傳遞，不能靠「目前是玩家回合」歸屬擊殺。生還友軍／召喚物擊殺不授予追擊。詳見 MAPGEN 第 19 節及本批 QA 紙條。

## 3.70 轉角規則與繞路

sight 仍是觀察，shotClear 限制對方未暴露的探頭點；不要將兩者合併。角落開火立即暴露，到當輪加兩個付費世界回合；敵我共用。友軍保留最後位置繞行，繩索／命令／哨兵限制保持。save v34 新增可選 cornerExposure／tactics，敵人封存計時平移，玩家與隨行友軍換層清除。UI API、驗證與 Claude 接手範圍見 [CORNER_TACTICS.md](CORNER_TACTICS.md)。

3.71：生成點最後一次成功產出後 hp 歸零，保留 prop 作為殘跡與子代來源；不新增存檔欄位。nest-art.js 管理雙風格 32px 素材與塌陷演出，來源／管線見 art/nests-v1/README.md。

2026-09-13 工作指示整理：依使用者指定的 [OpenAI 文章](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)，AGENTS 改為按需文件入口，驗證依風險分配且沿用未變動程式的通過結果。純文件走 RELEASE 的輕量交付；原有分工、保存保障與遊戲發布要求保留。這是專案指示調整，沒有修改全域模型設定或內建技能，也沒有宣稱已量測 token 節省比例。

3.72.0：`pet-growth.js` 管理德魯伊羈絆（player.petBond）、四條餵養成長、燃料、重生、只讀 UI 報價。save v35 遷移 packed/down 寵物；羈絆與身體皆全局，勿加入 FLOOR_FIELDS。餵食介面尚待 Claude 接線，API／數值／測試場景見 [DRUID_FEEDING.md](DRUID_FEEDING.md) 第11節。

3.73.0：德魯伊四線六節點、save v36 的煙霧樓層額度／堅守／固定感知座標與倒數。enemy.petSuppressed 按自身機會消耗，隨敵人封存；pet:vision 僅共享感官專用來源、不可清掉其他來源。只讀 UI API 見 DRUID_FEEDING 第14節；Claude 接 ◆ 節點樣式、感知光點與新狀態列。

3.74.0：統一壓制／學習資料／貨櫃內容池。save v37 新增 player.learningItems 與可選 actor.suppression，清除舊 petSuppressed（含封存敵人）；profile5／backup1 不變。生成世代9，新貨櫃存定內容，舊箱不補抽。公開 API 與 Claude 介面工作見 SUPPRESSION 第11、12節。

3.75.0：敵人詞條／行為樹／壓制抗性，save v38、生成世代 10。難度偏移共用於詞條與生命／傷害成長；詞條與擲彈預告保存於既有 enemies／marks，封存與完整備份均沿用。REAL_MODE 尚未實作，僅留不顯示的喊話 observer。詳見 ENEMY_AFFIXES 第 8、9 節。


3.76.0：`real-mode.js` 管部署鎖定、結算報價；`callouts.js` 管白名單與可見／聽覺遮蔽。save39 新增 realMode，舊檔 false；profile5 帳本可選 realBonus 及歷史模式欄位，備份1。喊話事件不存檔、不耗 RNG；onEnemyCallout 改接遮蔽後 payload。介面／音效由 Claude 接，完整契約見 REAL_MODE 第 7、8 節。

3.78.0：faction-catalog.js 為出生表唯一來源，factions.js 提供名稱、覆寫與存檔查詢。save40 新增 facilityFaction／actor.faction，舊檔補 legacy；友軍保留派系。詳見 FACTION_DATA 第 13 節。

3.79.0：elite-enemies.js 使用獨立出生亂數補抽精英詞條，只加經驗。save41 新增可選 elite:true，舊檔清除；友軍不繼承。實際生成精英才包世代11，預設 MAP_GENERATION 維持10，讀取上限 MAX_MAP_GENERATION 為11。詳見 ELITE_ENEMIES 第6、7節。

3.82.0：civilians.js 管通用非戰鬥人口、尖叫與逃跑；isNoncombatant 標籤查詢在 enemy-data.js。平民仍存於enemies但排除戰鬥預算、任務、自動鎖定、友軍選敵、召喚、詞條與精英。save42新增 screamCooldown，人口層世代12、讀取上限12。素材只追加圖集第17格；製程與介面交接見 CIVILIANS 第7節。

3.84.0：swarm.js／swarm-tuning.js 管毒液、資料化鉤舌與感染裂蟲。melee-classes.pullLanding 由狂戰士與鉤舌共用，規則不變；save43可選intent／冷卻／父子代欄位，舊檔不重抽。新增素材第18格。SWARM第6節有欄位與Claude介面交接，第7節是尚未實作的蟲潮提案。

3.85.0：swarm-waves.js 管獨立蟲潮與可選FLOOR_FIELDS.swarmWaves，renderer共用增援預告查詢。poison.js 統一疊層毒素、退層計時與清毒；save44將舊剩餘回合ceil/2轉層，不重生成既有樓層。數值仍集中SWARM_TUNING；欄位與驗收見SWARM第9節。


## Kill house（3.87.0）

- 規則入口 `src/killhouse.js`；`KillhouseGame` 共用 Game 戰鬥，不加入戰役 MISSIONS。地圖池 `killhouse-maps.js`，待決開關 `killhouse-policy.js`。
- 模擬局只在記憶體，不得序列化成 ash-save；storage 儲存／放棄／結果／備份都分流。備份模擬畫面時匯出保留中的原戰役，永不以空 campaign 蓋掉它。
- 單局 save44、完整備份1保持；PROFILE_VERSION=6（killhouse 教學旗標／最高分），`killhouse-profile.js` 管旗標、分數驗證及高水位，分數權重由 Claude 決定。
- 地圖美術登錄 `map-styles.js`：facility 原素材與選材完全保留；killhouse 使用新 32px 圖集。可選 mapStyle 歸樓層所有權，換層／封存清楚隔離。
- 首次強制入口、房間提示、全息人形、死亡與分數畫面尚待 Claude 接。API 與流程見 [KILLHOUSE 第9節](KILLHOUSE.md#9-claude-介面交接)。

### Kill house 地圖（3.89.0）
街機以戰役第 4 層作配置模板、重建基礎人類敵人；教學為共用配方格式手工六區。入口資料 tutorialEntrances 與房間 firstRoom 供提示使用。風格角色可指定獨立 atlas，新增 killhouse-v2；詳見 KILLHOUSE 第 12 節。

### 解鎖目錄（3.90.0）
PROFILE 7、SAVE 45、BACKUP 1。取消攜行，舊點數退款、超量彈藥落地，已鎖角色可續玩。unlock-catalog 是目錄/純交易，storage.grantUnlock 為原子寫入，run-unlocks 管逐層派系、屍體與待確認故事；content/stories 由使用者維護，stories.mjs 在 dev/build 前編譯。詳細 API、遷移、介面分工與 QA 場景見 UNLOCKS 第 11–12 節。

3.90.1（Claude；Codex 額度不足期間，Claude 在 Codex 範圍內的變更待 Codex 複查）：玩家檔案新增頂層 `unlockLedger`，防止仍開著的 3.89 分頁把檔案寫回 v6 後重設解鎖；v3–v6 退款上限 `earned − balance`；storage 的 `grantUnlock` 只做購買，屍體走 `connectUnlocks` 綁定。介面在 `src/unlock-ui.js`（解鎖頁、鎖定列、結算故事）與 controller／renderer（屍體互動與繪製）。細節與未處理的複查建議見 UNLOCKS 第 13 節。

3.91.0（Claude）：工程師工坊第 1 階段，SAVE 46。`src/workshop.js` 管藍圖、生產、部署、存檔遷移與驗證；上限與機體數值在 allies.js 的 `WORKSHOP_TUNING`、`lineLimit`、`deployLimit`。僚機技能、收納、回收與修理已移除，ALLIES.md、SKILLS.md 裡舊的工程師僚機段落以 ENGINEER.md 為準。identity harness 另外不雜湊空的生產序列。

3.92.0（Claude）：工坊第 2 階段浮游彈藥，SAVE 47。行為在 `src/workshop.js` 的 `munitionAct`，由回合迴圈的友軍分支呼叫；數值在 allies.js 的 `MUNITION_TUNING`。投擲物結算從 `throwGrenade` 抽成 `Game.applyThrowable`，玩家投擲不變（一致性基準完全相同）。

3.93.0（Claude）：工坊第 3 階段武器掛載，SAVE 48。製作、部署帶彈匣與掉落在 `src/workshop.js`（`mountableSlots`、`dropUnitWeapon`），射擊在 allies.js 的 `allyWeapon` 掛載分支與 `mountedHit`；`Game.restore` 的武器位置檢查包含生產序列與機體。

3.94.0（Claude）：工坊第 4 階段敵方藍圖，SAVE 49。取得在 `src/workshop.js` 的 `salvageBlueprint`（由 `Game.hurt` 呼叫；敵方自爆機器人自爆時把自己當攻擊者傳入，所以不給藍圖）；改造自爆機器人的行動在 `bomberAct`，被打爆時的爆炸在 `unitDestroyed`（由 `Game.damageAlly` 呼叫）；數值在 allies.js 的 `ENEMY_UNIT_TUNING`，機體種類與一次性機體在 `UNIT_SOURCES`、`ONE_SHOT_UNITS`。identity harness 另外不雜湊空的藍圖清單。

3.95.0（Claude）：工坊第 5 階段頭目藍圖，SAVE 50。`once` 藍圖製作時記到 `player.usedBlueprints`；封鎖官蓄力（`primed`）與核心守衛交替轟炸（`bombard`、`kind:'ally'` 地圖標記）在 allies.js 的 `actAlly` 攻擊流程；標記沿用回合結束的轟炸結算，存檔檢查在 enemy-intents.js 的 `validEnemyMarks`。內建武器以 `builtIn` 標示不用彈藥。identity harness 另外不雜湊空的已製作清單。

3.96.0（Claude）：工坊第 6 階段修理（使用者決定不做拆解），存檔版本不變。`repairTargets`、`repairReason`、`repairUnit` 在 `src/workshop.js`，數值 `REPAIR_TUNING` 在 allies.js，行動 `repairUnit` 由工坊面板送出（不放互動鈕，避免追隨無人機受損時佔住互動鈕）。工程師重設計（docs/ENGINEER.md）六個階段到此完成。

3.97.0（Claude）：手機介面。
- **捲動鎖定**：`fitLayout` 在戰鬥畫面放得下時加上 `html.scroll-locked`；CSS 在 expansion.css 末段，另有非被動的 `touchmove` 攔截。
- **固定主按鈕**：`modal()` 的 `pinFooter` 把選單最後的 `.modal-button`／`.modal-row` 移進固定在底部的 `.modal-footer`；需要兩個按鈕的選單直接寫 `.modal-footer`。
- **背包**：精簡版在 `showInventory`、`learningSection`，說明用 `data-pack-info` 展開；行動員數值與被動規則在 `showJournal` 的 `operatorStatus`。
- **長按與空欄位**：長按區塊在 controller 的 `pointercancel` 之後；沒有預備時點一下開分頁在 `grenade()`、`skill()`、`useItem()`。
- **選單尺寸檢查**：在 `?test=1` 的局內、375×635 視窗，主控台執行 `const {checkMenus}=await import('/qa/menu-fit.js');console.table((await checkMenus()).rows)`。背包四個分頁必須完全放得下，其他選單只要求主按鈕在畫面內。

3.97.1（Claude）：使用者在主畫面捷徑實測後的修正。
- **訊息列**：`#field-messages` 移到標題列下方（expansion.css 的 `grid-template-areas`）。
- **分頁選單**：有 `role="tablist"` 或 `.journal-tabs` 的選單由 `modal()` 加上 `tabbed`（3.97.1 是固定在頂端，3.97.2 起改成底部抽屜）。
- **背包**：不再有「資料與紀錄」按鈕；行動員狀態從右上選單的「行動員狀態、任務紀錄與敵人圖鑑」進入。

3.97.2（Claude）：選單改成底部抽屜（使用者要求單手操作）。
- **版面**：`@media(max-width:600px)` 下 `#modal:not(.title)` 貼齊底部、滿寬；`#modal.tabbed` 再填滿高度，上緣固定。
- **底部列**：`pinFooter` 把分頁列（`[role="tablist"]` 或 `.journal-tabs`）移進 `.modal-footer`，和主按鈕一起固定；`.modal-footer` 的下方內距加上 `env(safe-area-inset-bottom)`。
- **注意**：填滿高度的抽屜要靠 `#modal-content` 的 flex 欄與 `.modal-footer{margin-top:auto}` 把底部列推到下緣；只有 sticky 時，內容短的分頁會讓它停在中間。

3.97.3（Claude）：升級三選一改貼畫面上緣（使用者回報連點誤觸）。
- **判斷**：`modal()` 看內容裡有沒有 `[data-perk]`，有就加上 `raised`；升級是唯一會自己跳出來的選單。
- **版面**：`@media(max-width:600px)` 下 `#modal.raised:not(.title)` 改成 `margin:0 0 auto`，上方內距加 `env(safe-area-inset-top)`；三張卡片落在畫面上半部，拇指那一下打在遮罩上。

3.98.0（Claude）：操作區排版與方向鍵大小做成設定。
- **變數**：`.control-deck` 帶 `--pad-cell`／`--pad-gap`，方向鍵格子與字級都由變數算出；controller 的 `applyDeck()` 負責寫入。
- **九宮格**：`.control-deck.corner-pad` 把 `#interact` 放 `grid-area:1/1`、`[data-action="reload"]` 放 `1/3`，右側 `.action-buttons` 改兩欄兩列並拉滿方向鍵的高度。
- **搬動而非複製**：`applyDeck()` 把同兩顆按鈕移進 `.direction-pad`，回經典時放回「開火之後」與最後一顆（就是原本的 HTML 順序）。因為程式一律用 `[data-action]` 全域查詢，狀態更新、長按綁定、`.aiming` 高亮都不用改。
- **設定**：`ash-pad-layout`（classic／corner）與 `ash-pad-cell`（44／52／60／68）存本機，開機時讀回並套用。

3.98.1（Claude）：移除選單右上角的 ×，並禁止縮放。
- **×**：`index.html` 的 `#modal-close`、`style.css` 的 `.modal-close` 與 `modal()` 的 `closable` 都拿掉。它只在內容含 `data-modal="close"` 時出現，所以每個會顯示它的選單本來就有返回鍵。
- **為什麼要拿掉**：`float:right` 的方塊碰上 3.97.2 之後的 flex 欄內容（自成格式化脈絡）會整塊避開，`#modal-content` 在 375 寬時從 343 被壓成 295。
- **禁止縮放**：viewport 加 `maximum-scale=1,user-scalable=no`；`html{touch-action:pan-x pan-y}`（touch-action 沿祖先鏈取交集，等於全頁禁止縮放但保留捲動）；另外擋掉 WebKit 的 `gesturestart`／`gesturechange`／`gestureend`，因為 iOS Safari 會忽略 `user-scalable=no`。
- **注意**：需要自己處理拖曳的元件要保留自己的 `touch-action`（例如白線滑桿的 `pan-y`），取交集後才不會被當成捲動。
- **標題流程**：`modal()` 依 `titleFlow` 加上 `standalone`，樣式抄標題畫面（整頁、不透明 `#0d1211`、`::backdrop` 同色），內容欄在寬螢幕上限 470／`.wide` 650。
- **`titleFlow` 何時為真**：`showIntro()`、`showResult()`、以及在非進行中的局按下部署（結算畫面的「重新部署」）。`#modal` 的 `close` 事件一律設回 false，因為對話框關閉就代表要露出戰場。
- **邊界**：局內選單（`entered` 且 `status==='playing'`）維持 3.97.2 的底部抽屜，看得到戰場；「查看最後戰場」仍然是結算後看地圖的方式。

3.100.0（Claude）：叛軍詭雷箱，SAVE 51。
- **規則**：`src/containers.js` 的 `rigContainers(g)` 在 `loadFloor()` 的 `prepareMission` 之後跑；只在 `facilityFaction==='rebel'`、非模擬時生效，用 `unlockRandom(seed,floor,箱子 id)` 抽，每箱 `RIG_TUNING.chance`、每層最多 `RIG_TUNING.perFloor`。
- **線索**：詭雷箱把 `indestructible` 刪掉、補上 `hp/maxHp`。controller 的點擊鎖定會從「有 hp 的 prop」裡挑，所以它鎖得到；`autoTarget()` 與 `cycleTarget()` 都只讀 `visibleEnemies`，所以不會自動鎖也不會輪到。
- **引爆**：`Game.detonateCase()` 清空內容、標記 opened、hp 歸零後才 `explode`（避免自己再被波及），開箱與被打壞共用它。
- **驗證**：`validContainers` 現在是二選一——正常箱（`indestructible:true` 且無 hp）或詭雷箱（`rigged:true`、無 `indestructible`、hp 在 0..maxHp）。

3.101.0（Claude）：格狀操作區。
- **版面資料**：`src/deck-layout.js` 的 `DECK_GRID` 是五欄三列的 15 格陣列，`DECK_BUTTONS` 把 id 對到選擇器，`validDeckLayout` 要求每顆按鈕恰好出現一次，`mirrorDeck` 逐列反轉。插槽編輯器要做的話就從這三個東西接。
- **套用**：`applyDeck()` 在格狀時把十一顆按鈕全部移進 `.direction-pad`（它變成整塊格網），用行內 `grid-area` 定位；行內樣式蓋得過 `.direction-pad .north{grid-area:1/2}` 那組舊規則。切回其他排版時按原始 HTML 順序放回兩個容器。
- **尺寸**：`sizeDeck()` 量出操作區寬度算格子大小（上限 76），`applyDeck()` 與 `fitLayout()` 都會呼叫，所以旋轉或改視窗時跟著變。
- **注意**：`.action` 的長按動畫、變灰與技能停用樣式已改成以 `.control-deck` 為範圍；再加新狀態時不要綁在 `.action-buttons` 底下，否則格狀模式會失效。

3.102.0（Claude）：按鈕位置可自訂。
- **資料**：`ash-deck-layout` 存 15 格陣列；`parseDeckLayout` 只接受通過 `validDeckLayout` 的內容，其餘一律回 null 改用 `DECK_GRID`。
- **編輯器**：controller 的 `showDeckEditor()`／`pickDeckSlot()`／`saveDeckLayout()`。互換用 `swapSlots`，每次互換就立刻套用並存檔，所以關掉選單就是結果。
- **鏡像**：`mirrorDeck` 逐列反轉後把 left／right 互換，維持羅盤方向；測試 `mirroring keeps the compass` 就是在守這件事。
- **限制**：只在 `padLayout==='grid'` 時可用（設定裡其他排版時按鈕停用），因為只有格狀的格子彼此等價。

3.103.0（Claude）：投放詞條與敵方浮游彈藥。
- **詞條**：`ENEMY_AFFIXES` 的 `deployer` 標了 `special:true`（不進一般池）與 `spawns:'munition'`（宣告它會把哪張卡放上場，faction 覆蓋率測試靠這個）。抽籤在 `rollEnemyAffixes` 末端，用自己的鹽 `deployer-v1`。
- **精英**：`rollEnemyElite` 的補齊池排除 `special`，保底數量也只算非 special 的詞條。這兩件事都做了才不會位移既有精英。
- **行為**：`enemy-behavior.js` 的 `deployMunition`（詞條分支）與 `munitionAct`（單位樹）。落點 `munitionSpot` 要求距離玩家正好等於彈藥射程、玩家看得到、且彈藥看得到玩家。
- **時序**：`spawnTurn` 記錄放出的回合，當回合不行動，所以玩家必定有一次行動。下一回合用 `pullLanding` 貼身後 `g.hurt(e,e.hp,e)`，由 death 分支引爆。
- **注意**：詞條分支不要抄「`!e.charge`」那個條件——一般槍兵只要看得到玩家就一直在 charge，抄了會永遠不觸發。

3.104.0（Claude）：訊息列併進標題列、假呼吸。
- **版面**：`#field-messages` 移進 `.battle-header`，`.battle-panel` 的 grid 少一列（`"header" "board" "loadout" "controls"`）。
- **休息狀態**：`restNotice()` 把訊息列還原成 `missionLine(view)`（原本的標題文字），`notify()` 的計時器改成「淡出 → 換文字 → 淡回」；`update()` 在休息狀態時會刷新它。
- **呼吸**：`Renderer.breathOffset(actor,type,time,size)` 回傳位移；相位用單位 id 雜湊錯開，`ENEMY_TYPES[type].mechanical` 與 `hp<=0` 與 `reduceMotion` 都回 0。畫法是兩次 `clip()` 繪製，不動圖檔。
- **注意**：新增會動的東西時記得接 `reduceMotion`，和長按填色、ID 標籤同一條規則。

3.105.0（Claude）：顯形距離。
- **規則**：`ENEMY_TYPES[type].revealRange`（可選）＋ `Game.revealed(watcher,e)`。`visible()` 先問 `revealed(player,e)`，`teamVisible()` 對每個友軍也問一次，所以只有一個地方決定「看不看得到」。
- **目前只有浮游彈藥有值**，且刻意等於它的 `range`（測試在守這件事）。
- **不影響 AI**：敵人用 `sight()`，看得到你與你看不看得到它無關。
- **裂隙**：隱形單位之後只要填 `revealRange`，不必改視線系統；但要記得同時設計反制手段（偵察感測、聲音等），不然「看不到卻被看到」會很難受。

3.113.0（Claude）：8 種職業主動技能移出學習資料池（`RETIRED_LEARNING` 保留 ID 供遷移），未識別貨櫃內容池 28 → 20。SAVE 55 的 `retireLearning` 把背包、地上、未開箱子與封存樓層中的舊資料換成 15 廢料，已學會的技能保留。`learning.js` 裡為伴生指揮與工坊預留的學習分支目前已無入口，但保留不動（已學會的舊存檔仍走 `initializeAllies`）。被動學習資料未動，待使用者決定。

3.112.0（Claude）：霰彈槍錐形。規則在新模組 src/shotgun.js：`coneTargets`（錐形內、射程內、看得見、射線通、未被更近單位遮擋，由近到遠）、`inCone`、`rayCells`（與 lineOfSight 同步進）、`shotgunBand`（三段距離傷害，玩家、機體、壓制射擊共用）。`Game.fireCone(aim)` 一發一顆霰彈、每個目標各擲命中與傷害，友軍走 `damageAlly`；鎖定目標是門、掩體、油桶時仍走原本單發。卡片 `SG-12` 新增 `cone:30, farFrom:5, farMin:21, farMax:27`，射程 6，保留 `splash` 給機體與壓制射擊。identity 完全未動。

3.111.0（Claude）：武器定位第一批。SR-07 沒有先等待一回合瞄準時命中 −40（`aimPenalty`，在 `shotChance` 只對玩家生效）；GL-03 改成對地板一格發射（`pointTarget`，新行動 `launch`，拒絕理由統一在 `launchReason`），不擲命中、必定爆炸、沒有最短射程。`action('fire')` 遇到發射器會自動轉成對鎖定目標那一格的 `launch`，所以鍵盤與機器人不用改呼叫。`tools/balance.mjs` 的機器人學會兩種新打法。identity 基準線完全未動。霰彈槍錐形的規格已記在 docs/WEAPONS.md，等這兩項驗證後再做。

3.110.1（Claude）：把 3.110.0 只做到 26% 的彈藥削減補到 −35.3%（每層 10.75 → 6.95 件，佔比 49.5% → 31.9%）。分類補給箱現在只放第 1 層就能用的三種彈藥，能量電池與榴彈彈藥改由第 3 層起的起始房供應。**更正：手槍彈其實在 3.110.0 就被砍了（2.80 → 1.81 件／層），只有霰彈未動**，詳見 CHANGELOG 3.110.1 的更正段。機器人總量與 3.110.0 相同，identity 的 bots 一筆未動。

3.110.0（Claude）：器材箱。三種消耗品進補給箱，每層各約 1 個，撿起來不設上限（終端的 3 個上限也一併取消）。每層內容物總量不變，彈藥從 10.75 降到 7.95 件（−26%），原本宣稱只扣步槍彈與榴彈彈藥、手槍彈與霰彈沒動——**這是錯的，手槍彈也被扣了**（見 3.110.1 更正）；原意記在 docs/WEAPONS.md 的使用者實戰回報。**第一次真的動到地圖生成**：identity 基準線 780 generation ＋ 110 missions ＋ 5 bots 全數更新，並以 A/B 探針逐筆證明差異只來自三種物品替換；tests/fixtures/mapgen-v1.json 的 24 筆逐位元釘選也一併更新，同樣先證明舊程式仍能重現舊雜湊、且新舊只差在補給箱內容。

3.109.0（Claude）：摺疊掩體。設置在邊線上的矮隔板而不是佔格的箱體，所以可翻越、封不死地圖，也不需要連通性檢查。按道具鍵進入設置狀態、四顆方向鍵亮起選邊，架設 1 回合、選邊不耗回合。拒絕理由由 `deployCoverReason(game,[dx,dy])` 提供，驗證與結算共用。打壞後在原處重建沿用同一個 ID 與邊線。終端 25 廢料，SAVE 54 新增 `player.barricades`。

3.108.0（Claude）：佩戴型道具。準備欄成為生效欄，戴上與脫下各 1 回合（佩戴件換別的東西是一次動作），佩戴期間道具鍵變灰但仍可點開背包。第一件是夜視鏡（終端 40 廢料，每局一件），佩戴期間套用既有的 `night_vision` 被動；被動由 `syncWearableTraits` 從欄位推導，不單獨存檔。SAVE 53 新增 `player.wearables`。順帶修掉 3.106.0 的終端三份白名單問題（噴劑與腎上腺素原本買不到），統一為 `terminalReason(game,option)`。

3.107.0（Claude）：消耗品直接從背包使用。背包道具分頁每列多一個「使用」鈕，`heal` 不再要求預備醫療包；手榴彈仍要，因為那一欄還決定丟哪一種。停用理由由 `itemUseReason(game,id)` 統一提供，`validateAction` 與背包列共用同一份答案。順帶修掉 3.106.0 兩個未發布的問題：噴「劊」錯字，以及讀檔驗證把免費移動綁在忍者天賦上，害非忍者用完腎上腺素後存檔讀不回來。

3.106.0（Claude）：修復噴劑與腎上腺素，SAVE 52。
- **catalog**：`src/prepared.js` 的 `PREPARED_CATALOG.item` 現在有三項；新增一項＝一筆資料＋一個玩家欄位＋一個行動分支＋取得來源＋存檔遷移。
- **免費行動的位置**：`actionCost` 回 0 的行動由 `action()` 裡的免費分支處理並 `return true`，**不會走到 `executePlayer`**。腎上腺素因此掛在 `Game.surge()`。
- **免費移動**：沿用 `game.shadowSteps`（忍者影步的計數器），所以兩者互斥、規則一致、存檔欄位不用新增。相關訊息已改成中性文字。
- **注意**：`action()` 會在驗證前清掉未用完的免費移動，所以「按了別的東西就沒了」是既有規則；腎上腺素自己在那行之前先擋下來，免得重複扣血。
