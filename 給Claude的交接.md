# 給 Claude：開發接手與規則層分工

## 新增授權：三職業友軍迭代

使用者要求 Claude 多輪處理工程師／死靈法師／德魯伊的位置控制、卡點與戰力。先讀 [三職業迭代範圍](docs/ALLY_ITERATION_SCOPE.md)：允許局部友軍 AI／尋路／讓路／指揮與必要引擎接線，這是下文規則禁改條款的明確例外，範圍內不必再請 Codex 批准。共用戰鬥／回合、資源守恆與保存保障保持；候選玩法尚未實作。

更新：2026-09-10。這是使用者為節省 Codex 週額度而授權的新分工，供 Claude 開發使用，不只是 QA 紙條。

## 先讀這裡

使用者授權 Claude 暫時接手非遊戲規則層工作，例如數值調整、全域經濟、選單；Codex 只在需要處理規則層時再介入。你可以在已授權範圍內修改正式程式、更新測試與文件、提交並發布 main，不必每個小改動再請 Codex 批准。新產品需求仍依使用者的任務與排序，不因接手就自動開工整份願望清單。

舊驗證紙條的「不改程式、只提交報告、不推送」只適用**純 QA 任務**，不能拿來阻擋這次開發授權。使用者新的明確要求優先於本文件；純討論不自行實作或推送，明確要求記代辦則先記錄。

讀取順序：

1. 根目錄 [AGENTS.md](AGENTS.md) 與 [docs/HANDOFF.md](docs/HANDOFF.md)（3.44.1 起改為現況手冊：分工、模組地圖、存檔與版本、發版；逐版經過看 CHANGELOG）。
2. [使用者願望清單.txt](使用者願望清單.txt)：目前排序、已完成、延後、待定。歷史提案不等於本輪授權。
3. 本次功能對應規格（下表）；[docs/DESIGN.md](docs/DESIGN.md) 是規格索引，[docs/CHANGELOG.md](docs/CHANGELOG.md) 可追溯取捨，舊的逐版段落原文在 `docs/archive/`。較新規格取代舊版內容，不能復原已取消的設計。
4. [給驗證者的紙條.md](給驗證者的紙條.md)（最新一批＋尚未驗證總表）及最新 `qa/results/` 報告。先看版本與受測 SHA，再看通過／未測項。

## 接手基準與檔案位置

- 主專案：`C:\codex_projects\shooter_roguelike`。
- 本文件最初以遊戲 **3.35.8**（main `d3c4ac4`）為基準；2026-09-11 更新到 **3.44.1**。往後以 HANDOFF 與 origin/main 為準。
- 保存：save **v27**、profile **v4**、完整 backup **v1**（版本清單已改為由常數推算，見 HANDOFF「存檔與版本」）。3.44.1 回歸為 466 項 Node 測試、build 通過；這是引擎／建置結果，不是手機或平衡驗收。
- 正式倉庫：https://github.com/darkbearlab/ash_protocol 。遊玩：https://darkbearlab.github.io/ash_protocol/ 。QA 一律 `?test=1`。
- Claude 既有隔離工作樹：`C:\codex_projects\shooter_roguelike\.claude\worktrees\codex-project-handoff-c04775`。以 `git worktree list` 確認實際路徑與分支，不假定該樹已追上 main。
- 外部回報優先找 `.claude/worktrees/*/qa/results/`，交接也找 `.claude/worktrees/*/docs/HANDOFF.md`；不要找不到主樹報告就宣稱缺件。另一人的工作樹只讀，合併透過 Git，不直接改對方檔案。
- 報告都在 `qa/results/`，檔名含日期與版本；3.36～3.44 是 Claude 自己的開發報告，每份末尾有發布紀錄。尚未驗證的項目彙整在驗證紙條的總表。請按版本找最新報告，不把規則測試當自然平衡驗收。
- 根目錄 `給Codex的紙條.md` 是 3.1.1 時期的舊收尾紀錄，不是最新發布狀態。外部未追蹤頭像 `art/portraits-custom/`、`assets/pixel/portraits/custom/` 與私人紙條原樣保留，不順手 git add、刪除或接入。頭像接入先前被延後，待使用者重新排程。

## 可以自主處理的範圍

這是**修改語意**的界線，不是按檔名分權。數值可能在規則檔內，選單檔也有 action／存檔的關鍵接線。

| 類型 | Claude 可做 | 保持不變的界線 |
| --- | --- | --- |
| 既有內容平衡 | 武器／敵人／角色 HP、傷害、裝甲、命中修正、配給、掉落率；技能既有持續／冷卻數值；修復價格與比例 | 調原參數，不改公式結構、觸發條件、先後手、目標選擇及回合定義 |
| 局內經濟 | 廢料價格、補給量、既有掉落權重、改裝成本，既有回復量 | 仍走現有行動與扣款入口，不把付費回合改免費，不新增死亡／遺體／換層資源來源 |
| 全域經濟 | 協定點數獎勵與價格、永久升級／既有武器角色解鎖的商店、購買／已解鎖 UI；依使用者需求接既有解鎖鉤子 | 不重複發獎、不清帳本、不覆蓋舊錢包；不憑空新增 run 中的戰鬥效果 |
| 選單與資訊 | 部署、背包、設定、結果頁、文字、排序、按鈕停用原因、無障礙、觸控尺寸及響應式排版 | UI 呼叫既有 Game.action／storage 入口，不直接寫 HP、彈藥、廢料、回合或任務完成欄位 |
| 顯示與資產 | 在使用者安排下調整文案、圖示、面板、素材選材與純視覺呈現 | 不藉顯示揭露未知敵人／地圖，不改投影選格、視線、牆遮擋與戰鬥結果播放順序 |
| 文件與 QA | 更新規格、代辦、變更紀錄、驗證報告、測試與人工場景 | 如實分開自己實測、舊報告、讀碼推論與未測；不為過測試刪掉行為保障 |

例：無人機修復 `10 → 12 廢料`、同一公式的修復比例、霰彈近射傷害，屬數值調整；「不用回收就能修」「修復順便解除 EMP」「切換哨兵自動換新機體」屬規則變更。冷卻 `6 → 5` 是平衡，但「施放輪是否算一輪」「免費行動是否倒數」是規則。回合成本 `1 → 0` 即使只改一個數字，也屬規則層。

全域經濟可能需要擴充 profile／購買流程，這**不表示所有儲存程式都禁改**。可對新商品／欄位做局部擴充，補遷移及還原測試，保留原資料與交易保障；若必須重寫帳本、存檔所有權或戰鬥模型，先拆出規則需求交回討論。`unlocks` 有資料接口不等於解鎖商店已做好；目前六角色免費，不自行把使用者已能玩的角色改成付費。

## 留給使用者與 Codex 討論的規則層

以下以 [三職業迭代範圍](docs/ALLY_ITERATION_SCOPE.md) 的局部開放為例外；該文件未開放的共用規則仍依此節。

遇到以下需求，先寫具體提案或問題重現，繼續完成不依賴它的 UI／數值工作；不要為了避免打擾而偷偷換規則，也不必讓一個規則疑點阻擋整批不相關工作。

- `Game.action / validateAction / executePlayer` 的行動承諾、initiativeQueue、快慢抵銷、狀態計時、免費操作與回合消耗。
- 射擊／近戰／爆炸／掩體／命中公式的判定方法，45° 與騎士方向的掩體分界、追蹤目標身分、目標逃離仍扣彈等。既有強度參數可調，分類方式與邊界語意不可當一般平衡改掉。
- 新被動／主動技能效果、AI 決策、感知與記憶、煙霧／夜視／紅外線相互作用、尋路或新地形通行。
- 友軍生命周期、繩索／同行判定方式、死亡／復活／召喚素材所有權、生成／行動時機；新寵物生命連結、指定物種召喚、友軍救援事件。
- 地圖拓樸、門／矮隔板阻隔、樓層快照與往返狀態所有權、任務完成條件及增援流程。
- 以選單重構之名繞過判定或先寫結果，再補動畫；renderer 必須呈現 presentation 快照，不能過早露出死亡／升級結果。

## 查資料與修改入口

| 工作 | 主要程式／參數 | 對照文件／測試 |
| --- | --- | --- |
| 角色配給、命中迴避修正 | `src/characters.js` 的 CHARACTERS、BASE_SUPPLIES；`src/actor-stats.js` | `docs/CHARACTERS.md`、`tests/characters.test.mjs` |
| 武器／敵人／掉落 | `src/data.js` 的 WEAPONS、ENEMY_TYPES、ENEMY_LOOT；`src/weapons.js` 的詞條；部分常數在 `src/game.js` | `docs/WEAPONS.md`、`docs/BULWARK.md`、`tests/weapons.test.mjs` |
| 彈藥容量與商店價格 | `src/ammunition.js` 的 AMMUNITION、CARRY_COSTS、TERMINAL_AMMO | `docs/AMMUNITION.md`；五種備彈分開，投擲物共用上限 |
| 友軍平衡 | `src/allies.js` 的 DRONE_*、PET_*、SUMMON_*、TETHER、FOLLOW_RANGE、allyWeapon、addAlly；3.39 起機體損毀改為花廢料生產新機（不再回收殘骸） | `docs/ALLIES.md`、`docs/ALLY_ITERATION_SCOPE.md`、`tests/allies.test.mjs`、`qa/*-waves.mjs`、`qa/ally-scenes.mjs` |
| 技能／投擲物強度 | `src/skills.js` 的 SKILLS、`src/throwables.js`、`src/lighting.js` | `docs/SKILLS.md`、`docs/THROWABLES.md`、`docs/LIGHTING.md` |
| 協定點數／永久升級 | `src/progression.js` 的 PROTOCOL_REWARDS、normalizeProfile、creditProtocol；`src/storage.js` 的 purchaseCarrying、recordResult；`src/ammunition.js` | `docs/PROGRESSION.md`、`docs/PROFILE_BACKUP.md`、`tests/progression-storage.test.mjs`、`tests/backup.test.mjs`、`tests/ammunition.test.mjs` |
| 菜單、按鈕、HUD | `src/controller.js`、`index.html`、`style.css`、`expansion.css`、`src/layout.js`、`src/target-card.js` | `docs/PREPARED.md`、最新驗證紙條；保留 modalAction→act→Game.action 管線 |
| 畫面／動畫／素材 | `src/renderer.js`、`src/presentation.js`、`src/themes.js`、`src/materials.js`、`src/walls.js`、`src/portraits.js` | `docs/PIXEL_ART.md`、`docs/TERRAIN.md`、`docs/MATERIALS.md`、`docs/WALLS.md`、`docs/PORTRAITS.md` |
| 規則定位只讀參考 | `src/game.js`、`src/combat.js`、`src/cover.js`、`src/traits.js`、`src/world.js`、`src/barriers.js`、`src/retreat.js`、`src/missions.js` | 對應 COVER_RULES／TRAITS／BARRIERS／RETREAT／MISSIONS 規格 |
| 發布 | `npm run bump -- x.y.z`（改 `package.json`、`src/version.js`、`sw.js` 的 CACHE）；`sw.js` 的 FILES、`tools/build.mjs`、`.github/workflows/pages.yml` | `docs/RELEASE.md`、`tests/release.test.mjs` |

先用 `rg` 找定義及呼叫端，避免只改說明未改實際值，或 UI 與引擎各抄一份價格。可以做小範圍、保持行為不變的數值抽常數；不要為了改價先重構整個引擎。

## 存檔與 UI 不可退步的條件

- 保存玩家正式局；瀏覽器一律 QA `?test=1`／`qa-`。完整匯出／匯入走 `src/backup.js` 與 storage 現有 API；不要清 localStorage、替玩家重置、把 QA 資源寫進正式錢包。
- `runId`、protocolRuns 累積最高紀錄與 recorded 標記避免重複入帳。歷史列表可裁切，去重帳本不可跟著刪。匯入同一局、死亡／放棄／重載不能再賺一次。
- 購買沿用資金／上限／預期等級驗證及單次持久化；失敗不能先扣款。新 profile 欄位在 normalize／驗證／備份往返中都不能被丟掉。
- 不為一般 UI 調整升 SAVE_VERSION。真的改資料格式，升版、相容讀取、保留舊原件、測遷移；穩定武器 slot、角色／道具 ID 與所有權不能悄悄重新編號。
- 調低容量要保留超額（用現有落地機制），不靜默刪資源；調價格要考慮舊永久升級退款計算是否引用同一價目。配給／HP 調整要明說只作用新局還是舊局，不用重新建角覆蓋舊玩家。
- 手機只縱向、四方向操作、禁止長按選字；互動不能推高戰場。HUD、卡片、背包要保留捲動、取消與可用按鈕。UI 讀目前 presentation 狀態，不提前用已結算實際 game 洩漏結果。
- 不改服務工作緒成跨版本混用 JS；資源維持 `/ash_protocol/` 相對路徑。生成圖要保留 prompt 與低解析／調色流程，外部自訂頭像規格在 `assets/pixel/portraits/custom/README.md`。

## 開工、驗證與發布

1. 在你自己的工作樹先看 `git status`、`git worktree list`，fetch origin，確認基底包含最新 main。已有修改先保留，不用 reset --hard／clean／強制切換處理；main 常駐主樹，不在另一個工作樹強搶 checkout main。
2. 開發分支做範圍內變更。對碰到的程式行為／經濟守恆跑相關測試；數值預期可依新設計更新，不能把不相容失敗都當過時測試刪除。常數修改可能有多個測試與說明引用，要一起更新。
3. 遊戲變更發布前 `npm test`、`npm run build` 通過。只改本類交接文件不重跑本機遊戲測試，依 `docs/RELEASE.md`；main 的 CI 仍自動測試建置。不要反覆跑無關自然局代理消耗額度。
4. UI 可由 Claude 驗證，真人手機／自然平衡交使用者；若工具影格迴圈凍結，報告未測，不改正式規則來適應工具。需新依賴或 schema 才增加相應測試；不要給純文案寫鏡像測試。
5. 更新 CHANGELOG、相關規格、報告、願望清單與驗證紙條最新段；HANDOFF 只在架構或流程改變時更新（3.44.1 起）。不要只把歷史往上堆卻留下「未做」的舊代辦。遊戲更新用 `npm run bump` 同步版號及快取；純文件交接不升遊戲版號。
6. 查看 diff，只 stage 本批確定的檔案，避免 `git add .` 收進別人的頭像、QA 腳本與私人紙條。`qa/fixtures/`、`qa/browser/`、`qa/node/` 已忽略；必要可重現的產品回歸測試放 `tests/`、生成器放 `qa/create-*.mjs`，可以隨開發提交。
7. 將完成變更正常合併 main 並 `git push origin main`。已獲持續發布授權，不必為正常提交再請示。另一人工作樹不直接寫；若 main 被另一活動工作樹持有，可用 GitHub PR 正常合併或獨立整合工作樹／分支基於最新 origin/main 產出可快轉提交後 `git push origin HEAD:main`，不 force push。遠端已前進就 fetch、合併解衝突並重驗受影響項，不覆蓋。
8. `python tools/github-release.py status` 用既有 Git Credential Manager 查固定倉庫；或看 Actions。確認**本次 main SHA**對應 run 為 completed／success，不只看首頁 HTTP 200／舊綠燈。已有 Pages 設定不用重設；憑證不輸出或寫入文件。無憑證／權限時交付已完成提交與阻礙，不宣稱推送成功。
9. 收工告知版本、SHA、部署、具體變更、測試與未測；未完成／未推送必須明列。不要留下完成功能只在 Claude 分支，讓使用者線上玩不到。

## 往後回報給 Codex 的格式

更新你自己工作樹的 HANDOFF，新增 `qa/results/YYYY-MM-DD-claude-版本-主題.md`；開發摘要也可放 `docs/handoffs/`（若新增，從主 HANDOFF 連結）。報告要整合到倉庫，而非只有聊天文字；同時把完整路徑告訴使用者。

```text
基底版本／SHA：
發布版本／main SHA／Pages run URL 與結果：
本批目標及修改檔案：
數值前 → 後／理由／影響新局或舊局：
是否碰到規則邊界；若有，使用者的明確授權與內容：
save／profile／backup 版號及遷移影響：
自己執行的測試／瀏覽器／真機驗證：
引用的外部結果（版本與路徑）：
已知缺陷／未測／下一步：
未提交檔案、所在工作樹及持有人：
需 Codex 處理的最小問題、重現 fixture／步驟與預期：
```

需要 Codex 時盡量附一個具體可重現規則問題，讓他從最新 main 接手；其他數值與選單工作可繼續。若只是市場價格、按鈕位置或文案，按使用者方向自行處理即可。
