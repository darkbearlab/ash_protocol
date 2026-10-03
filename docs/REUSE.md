# 系統可插拔指南：拿 ASH PROTOCOL 做變體

2026-10-03，Claude 依 3.222 的程式整理。這份文件寫給兩個讀者：
- 之後拆模組的 Claude：第 1、2、5 節；
- 做變體整體視覺設計的 Codex：第 3、4 節。

這是一張地圖，**目前沒有任何程式為了插拔而改過**。

變體可能是奇幻 roguelike、風格更黑暗的故事、帶動漫風立繪的版本，或在大地圖上完成任務的玩法。看完這份文件，應該能判斷哪些東西直接搬、哪些換資料、哪些要重寫，以及美術換皮要交出什麼規格的檔案。

## 0. 先決定：同一個 repo 的變體，還是新 repo

**建議開新 repo**：從某個版本標籤（例如 `v3.222.2`）分出去。原因：

- **存檔會撞**：瀏覽器的存檔依網域分開，不依路徑。變體如果也放在 `darkbearlab.github.io` 底下，會和 ASH 共用存檔（RELEASE.md「itch.io 凍結版」有同樣的說明）。
- **要改的身分常數**（現在散在各處，第 5 節第 1 步建議收成一處）：
  - 存檔鍵：37 個 `ash-*`，散在 7 個檔案。測試模式的 `qa-` 前綴由 `src/storage.js` 的 `storageKey` 加；語言鍵另外在 `src/i18n.js` 的 `LANGUAGE_KEY`。
  - `sw.js` 的快取名稱與檔案清單；
  - `manifest.webmanifest` 的名稱與主題色（`#101212`，`index.html` 也有一份）；
  - 素材網址的基準路徑 `/ash_protocol/`（AGENTS.md：素材網址一律相對）；
  - 標題畫面與 ABOUT 的版權、AI 說明文字。
- **同一個 repo 裡切換內容**，要等第 5 節的「內容包」邊界拆出來才實際可行。在那之前，硬塞一個變體開關會讓兩邊互相拖累。

## 1. 三層：直接搬、換資料、綁死

數字是 3.222 的實測：

| 項目 | 數量 |
| --- | --- |
| `src/` 模組 | 207 個 |
| 不 import 任何模組的模組 | 37 個 |
| `g.player`／`this.player`／`game.player` 的引用 | 805 處，分布在 80 個檔案 |
| 地圖大小 `SIZE` | 27（`src/data.js`） |

### A. 跟題材無關，幾乎可以直接搬

| 系統 | 模組 | 說明 |
| --- | --- | --- |
| 回合規則的骨架 | `game.js`、`game-actions.js` 的 `action`／`validateAction` | `Game.action` 是唯一的回合入口，先驗證再執行，無效操作不耗回合。行動順序是快速 → 普通 → 緩速。亂數跟著存檔，非戰鬥的東西用各自的雜湊。 |
| 敵人招式登錄表 | `enemy-specials.js`（零 import） | `registerSpecial`／`registerStep`／`registerAffixBranch`：預告、打斷、回合開頭倒數、讀檔修剪與檢查、目標卡文字。目前 14 個模組在這裡登錄。奇幻的吐息、詠唱、衝鋒可以直接掛上來。 |
| 偵測警報 | `detection.js`（零 import） | 藏起來的東西登錄偵測器，管制員依範圍提醒。 |
| 演出管線 | `presentation.js`、`camera.js`、`screen-shake.js`、`callouts.js`／`callout-ui.js` | 動作先記快照再播放，介面不提早露出結果；另有喊話泡泡與畫面震動。 |
| 血光與屍體 | `gore.js`、`gore-art.js`、`corpse-layer.js` | 全部用程式畫，顏色來自 `GORE_PALETTES`（血肉、蟲族、機械），換題材只改色表。 |
| 存檔與進度 | `storage.js`、`backup.js`、`progression.js`、`stale-runs.js`、`run-log.js`、`replay.js` | 帳本防重複領獎、舊任務作廢、完整備份、操作紀錄回放。 |
| 文字 | `i18n.js` 的 `t()`、`tools/glossary.mjs`、`qa/english-scan.mjs` | 雙語整句樣板、名詞表、英文掃描。 |
| 通訊與教學 | `comms.js`、`comms-events.js`、`course-script.js`（零 import）、`story-text.js` | 管制員的臉譜、表情、台詞事件；`say()`／`card()` 教學腳本；設施紀錄加評論（`content/stories/` 的 `=== COMMS ===` 格式）。 |
| 品管工具 | `qa/enemy-data-identity.mjs`、`qa/special-matrix.mjs`、`qa/save-fuzz.mjs`、`qa/render-snapshots.mjs`、`npm run test:quick`、通關機器人 | 這是最有價值的一塊：每一步重構都靠它們證明「行為不變」。 |
| 發版與素材流程 | `tools/build.mjs`、`npm run itch`、`sw.js`、`tools/github-release.py`、`tools/pixelize_*.py` | 美術流程見第 3 節。 |
| 小型工具 | `mixin.js`、`frame-rate.js`、`screen-tone.js`（上方間距、操作面板下移）、`pixel-text.js`、`daily.js`、`traces.js`、`pursuit.js` | 零 import，直接帶走。 |

### B. 規則通用，換資料或換皮就能用

| 系統 | 模組 | 換成什麼 |
| --- | --- | --- |
| 武器與敵人卡 | `data.js`（武器、敵人卡、`SAVE_VERSION`）、`enemy-data.js`、`weapons.js`、`ammunition.js`、`characters.js` | 弓、法術、魔物卡。攻擊型態可以沿用：射程、錐形（霰彈 → 吐息）、拋射（榴彈 → 火球）、穿刺（長槍）、近戰、投擲物。 |
| 派系 | `factions.js`、`faction-catalog.js` | 魔物部族或敵對教團。`overrides` 可以加特性與階數。 |
| 詞條與難度 | `enemy-affixes.js`、`endless.js` 的 `DIFFICULTY_CURVES`、`scaledChance`、`ENDLESS_TUNING` | 換成祝福或詛咒詞條，難度曲線與無盡凍結照用。 |
| 特性與狀態 | `traits.js`、`actor-stats.js`、`status-timers.js`、`suppression.js` | 壓制可以換成恐懼或士氣。 |
| 危險地形與環境 | `fire.js`、`vents.js`、`hazard-paths.js`、`lighting.js`、`flares.js`、`throwables.js` | 魔法火、毒霧、詛咒地形；手電筒換火把。 |
| 敵人行為 | `enemy-behavior.js`、`squad.js`、`tactics.js`、`ambush.js`、`flank.js`、`concealed.js` | 小隊與無線電換成號角；「知道攻擊從哪裡來」、目擊、埋伏都通用。 |
| 頭目 | `boss-scenes.js`（出場與擊殺演出）＋各派系頭目模組 | 演出框架直接用。招式模式（標定、扇形掃射、火圈、直線衝鋒、產卵）換皮重寫。 |
| 地圖與任務 | `world.js`、`map-*.js`、`missions.js`、`vault.js`、`scenery.js` | 房間加走廊很適合地城。任務已有撤離、生存波次、據點、增援傳送門。 |
| 友軍 | `allies.js`、`workshop.js`、`pet-growth.js`、`melee-classes.js` | 隨從、召喚獸；終端機換商人。 |
| 文字內容 | `text-*.js`、`voices-*.js`、`content/stories/`、`COMMS_LINES` | 整套換掉；格式與檢查工具保留。 |

### C. 綁死現在設計，換玩法就要重寫

| 假設 | 在哪裡 | 影響 |
| --- | --- | --- |
| 只有一個主角 | `g.player` 805 處、80 個檔案：敵人選目標、視野、鏡頭、介面、陣亡演出、存檔 | 多主角（三人階段制）等於重寫核心。比較便宜的過渡做法：對友軍下指令。 |
| 一次一格、四個方向 | `game-actions.js` 的 `move`（曼哈頓距離 1）；地雷、危險格、開門、視野、埋伏現形都掛在「每一步」 | 「鉤索式多格移動加慣性」要重新定義移動中的觸發。疾行的「每一步照規則」可以當藍本。 |
| 固定大小的樓層、一層一層往下 | `SIZE` 27、`game-floors.js`、`retreat.js` 的 `floorStates`、renderer 一次畫整層 | 大地圖要分區載入與新的地圖生成。 |
| 直式手機介面 | `controller*.js`、`fitLayout`、操作面板、`expansion.css` | 概念可以沿用，程式要重做。 |
| 回合制 | 整個核心 | 即時制的話，核心帶不走；資料、設計概念、存檔、文字、工具、美術流程帶得走。 |

## 2. 現有的接縫：要擴充時照這些方式做

- **新的預告招式**：在擁有招式的模組呼叫 `registerSpecial`，順序由 `ORDER` 決定。CHECKLIST 第 2 節列了每個招式必須宣告的東西。
- **新的詞條**：在 `enemy-affixes.js` 加一筆，帶 `applies`、`chance`（經 `scaledChance` 吃難度倍數）與 `registerAffixBranch`。
- **派系的單位與特性**：`faction-catalog.js` 的 `overrides`。
- **管制員**：
  - `COMMS_SPEAKERS`：名字、臉譜表、表情對格子；
  - `COMMS_LINES`：各事件的台詞；
  - `COMMS_EXPRESSIONS`：各事件的預設表情；
  - `comms-events.js`：觸發時機。
- **教學**：`course-script.js` 的 `say(說話者, 表情, 台詞)` 與 `card(…)`。
- **房間外觀**：`themes.js`、`map-styles.js`。這裡只換外觀，不改規則（OTHERWORLD.md）。
- **顯示偏好**：`screen-tone.js`，存在各自的裝置上，不進存檔。

## 3. 美術換皮規格（給 Codex）

變體的整體視覺可以完全重做，但程式畫圖時對尺寸、格子、色數有固定的假設。下表是 3.222 的實際規格，數字由檔頭與程式確認。

### 3.1 素材家族

| 家族 | 檔案 | 規格 | 讀取的模組 |
| --- | --- | --- | --- |
| 單位與道具 | `assets/pixel/atlas.png`（＋`atlas.json`） | 128×160，32px 一格，4 欄 5 列 | `renderer.js`；名稱在 `enemy-visuals.js` 的 `SPRITE_NAMES`（只能往後加） |
| 屍體與命中 | `assets/pixel/aftermath.png`（＋json） | 128×160，32px | 同上，`AFTERMATH_NAMES`；屍體用灰化的副本 |
| 職業（玩家與除名幹員） | `assets/pixel/classes-v1/atlas.png` | 128×128 索引色；第 0–1 列是 8 個職業站姿，第 2–3 列是倒地 | `class-art.js`；**必須是灰階**，幹員塗裝色由 `operator-color.js` 依灰階上色 |
| 地板與道具 | `assets/pixel/terrain-v1/atlas.png`（＋`manifest.json`） | 128×128，16 格，32 色 RGB555 | `themes.js`、`map-styles.js` |
| 牆 | `assets/pixel/walls-v1/atlas.png` | 128×128；8 個牆面加 8 個牆頂 | `walls.js`；畫法是半格牆面加一整格牆頂 |
| 門 | `assets/pixel/doors-v1/atlas.png` | 64×64：關、蓋、框、損壞 | `barrier-art.js` |
| 場景物件 | `assets/pixel/scenery-v1/atlas.png` | 128×128 | `scenery.js` |
| 巢穴 | `assets/pixel/nests-v1/atlas.png` | 128×64；第 0 列地洞，第 1 列裂隙；欄是休眠、活躍、崩塌、廢墟 | `nest-art.js` |
| 派系貼花 | `assets/pixel/faction-decals-v1/atlas.png` | 768×128，六張 4×4、32px 的貼花表 | `faction-decals.js`（`CELL_BOUNDS` 抄自 JSON） |
| 掉落物圖示 | `assets/pixel/loot-icons-v1/atlas.png` | 128×32，16px 一格，8×2 | `loot-icons.js`（畫成 21px；近戰武器會染色） |
| 火與煙 | `assets/pixel/fx-v1/` | 4-bit 索引色；fire 128×96、smoke 128×160、vent 160×128、flame-burst 128×32 | `fx-sprites.js` |
| 煙霧場 | `assets/pixel/smoke-field-v1/` | `layers.png` 1280×256（五張 256px 無縫貼圖），`baked-*.png` 256×256 | `renderer-clouds.js` |
| 管制員臉譜 | `assets/pixel/comms-v1/` | 64px 一格，寬 256，**最多 16 色、色值限 Mega Drive 八階** | `comms.js`（簡短框取 43×43 的窗） |
| 幹員頭像 | `assets/pixel/portraits/` | 64×64，4-bit 索引色 | `portraits.js` |
| 擊殺屋 | `assets/pixel/killhouse-v1/`、`killhouse-v2/` | 128×64、128×224，32px | 擊殺屋模組 |
| 教學卡 | `assets/course/*.png` | 遊戲截圖，有 `.en` 版 | `course*.js` |
| 程式繪製 | 沒有圖檔 | 血光、陣亡演出、槍口火光、介面圖示（`ui-icons.js`） | 換風格要改程式或色表 |

### 3.2 畫面上的固定假設

- **格子大小**：畫面一格是 38 CSS 像素（寬度 600 以上是 45），像素比上限 2。32px 的圖大約 1:1 畫在一格裡，每一幀都關掉平滑（`imageSmoothingEnabled=false`）。
- **程式寫死的來源格子尺寸**：一般是 32px，掉落物 16px，臉譜與頭像 64px。要換解析度，就要同時改畫圖的程式。
- **`art-tone.js` 會調亮度**：地板亮度統一到亮度值 52.4；單位圖亮度 ×1.3、飽和度 ×1.5。新的美術要在遊戲裡看效果，不要只看原圖。
- **少圖不會壞**：圖讀不到時，單位改用 `drawing.shape` 程式畫（人形、蟲、無人機），牆和門畫成色塊，臉譜顯示 SOUND ONLY。所以變體可以分批換圖，沒換到的先用程式畫的。

### 3.3 介面的顏色與字型

- **`style.css`** 有色彩變數（`--bg`、`--panel`、`--line`、`--muted`、`--text`、`--orange`、`--green`），字型是 Barlow Condensed、IBM Plex Mono、Noto Sans TC。
- **`expansion.css`** 寫死了 356 個色值（220 種），只有 187 處用變數。所以**改變數只能換掉一部分顏色**。換配色之前要先把這些色值收成變數，這是程式工作（第 5 節第 2 步），不是美術工作。
- **戰場的背景色**寫在 `renderer.js`（例如 `#10191a`）。
- **沒有配色主題切換**；唯一的全畫面濾鏡是 VHS（`html.vhs`）。

### 3.4 美術流程與規則

- **AGENTS.md**：生成的美術要把提示詞和固定、可重現的像素化與調色處理留在 `art/`；新檔案要列進 `sw.js`。
- **既有流程**：每個家族一個 `art/<家族>-v1/`，放提示詞與原圖，加一支 `tools/pixelize_*.py`。這些程式會分格、縮圖、壓色、固定到 RGB5 色階、不抖色，再輸出索引色 PNG、JSON 與 4 倍預覽。細節在 docs/PIXEL_ART.md。
- **臉譜流程**：`tools/pixelize_comms_portraits.py` 做出 4×4 的臉；手修後用 `tools/pack_comms_sheet.py` 收表、封存舊表、在 `art/comms-v1/installed.json` 記錄。鷦鷯 3.222.1 的手修就是這樣裝的。
- **gpt-image 產生的像素圖原圖**一律用 `--quality low`（使用者授權）。

### 3.5 換圖時會被測試擋下的地方

測試鎖了雜湊與格式，所以換圖要連 JSON／manifest 裡的 sha256 一起更新，也要保留測試要求的格式：

| 測試 | 檢查 |
| --- | --- |
| `tests/art.test.mjs` | 職業圖 32px、4-bit、只有灰階、索引 0 透明、雜湊；atlas 的單張最多 16 色、RGB5 |
| `tests/comms.test.mjs` | 臉譜寬 256、整列 64px、索引色、最多 16 色、Mega Drive 色階；列在 `sw.js` 與 `server.mjs`；格子數對 `installed.json` |
| `tests/themes.test.mjs`、`tests/walls.test.mjs`、`tests/barrier-art.test.mjs`、`tests/nest-art.test.mjs` | 尺寸、共用色盤、雜湊、離線清單 |
| `tests/faction-decals.test.mjs`、`tests/loot-icons.test.mjs`、`tests/portraits.test.mjs` | 雜湊、邊界、尺寸 |
| `tests/smoke-field.test.mjs` | 4-bit、RGB5、manifest 雜湊、處理程式的常數和畫面一致 |
| `tests/map-styles.test.mjs` | 素材網址與格子，對照 `tests/fixtures/facility-art-3.86.0.json` |
| `tests/enemy-visuals.test.mjs` | 每張卡片都指到存在的格子與形狀 |

### 3.6 給動漫風立繪、更黑暗故事的提醒

- **立繪**：現在的管制員臉譜是 64px、16 色、Mega Drive 色階，故意做成復古通訊頭像。要更精緻的美少女立繪，建議兩層並存：
  - 戰場通訊框照舊用小的像素臉；
  - 另外加一層高解析度立繪，給簡報、劇情、選單用。

  這樣不用動通訊框的版面。要直接放大通訊框裡的臉，就要一起改 `comms.js` 的取臉窗、`.comms-portrait` 的 CSS 尺寸，以及 `tests/comms.test.mjs` 的格式檢查。
- **更黑暗的故事**：文字都在 `text-*.js`、`voices-*.js`、`COMMS_LINES` 與 `content/stories/`；陣亡與損失報告是管制員的台詞事件。血腥程度看 `gore.js` 的色表與設定裡的「擊殺血光」。
- **配色**：先完成第 5 節第 2 步，CSS 收成變數，換配色就只是一張色表。

### 3.7 視覺設計交件清單（範本）

每個家族交這些東西：
- 原圖加提示詞，放 `art/<家族>-v2/`；
- 固定、可重現的處理程式（可以沿用 `tools/pixelize_*.py` 改參數）；
- 成品放到 `assets/pixel/<家族>-v2/`，尺寸與格子照 3.1 節；
- JSON 或 manifest，含雜湊；
- 4 倍預覽圖；
- `sw.js` 的新檔案清單。

換掉圖片網址、改測試的雜湊與檔名，由 Claude 處理。

## 4. 變體對照

| 方向 | 可以沿用 | 要重寫 |
| --- | --- | --- |
| 奇幻 roguelike（單人、回合、格子） | 第 1 節 A 層全部、B 層大部分 | 資料、美術、文字 |
| 鉤索式多格移動（加慣性） | 瞄準流程（選格、預覽、確認）、疾行的逐步規則、天誅的穿越規則、帶危險成本的找路、路徑動畫 | 移動行動與移動中的觸發（陷阱、危險格、監視射擊）、轉角與掩體系統 |
| 三人階段制 | 職業與技能、友軍 AI、敵人小隊邏輯、招式登錄表 | 所有 `g.player` 的地方、介面的選人與切換、速度系統、平衡 |
| 大地圖任務，回合制 | 任務系統（撤離、生存、據點、增援）、投放與轟炸標記（就是戰略支援的雛形） | 大地圖生成、分區載入、鏡頭 |
| 大地圖任務，即時制 | 資料、設計概念、存檔、文字、工具、美術流程 | 回合核心與演出管線 |

## 5. 往可插拔走的順序（給 Claude）

每一步都要先證明行為不變，才能進下一步（AGENTS.md）：
- `node qa/enemy-data-identity.mjs` 完全一致；
- 招式對照表一致；
- 畫面快照一致；
- 存檔隨機測試乾淨。

1. **身分常數收成一處**：存檔鍵前綴、語言鍵、快取名稱、主題色、素材基準路徑。風險低，做完開新 repo 只要改一個檔。
2. **介面與畫面的顏色收成變數**：`expansion.css` 那 220 種寫死的色值、`renderer.js` 的背景色。畫面快照必須逐像素相同。
3. **內容包的邊界**：把 ASH 專屬的資料移到一個內容索引後面，引擎經由登錄表讀取，不再直接 import。要移的資料：派系、敵人卡、武器、頭目表、管制員、台詞、紀錄。招式登錄表就是現成的做法。
4. **移動行動一般化**：讓 `move` 可以帶路徑，每一步照現有規則結算。只有要做多格移動的變體才需要。
5. **主角一般化**：把 `g.player` 換成「隊伍」的存取方式。805 處，工作量最大；只有多主角的變體才需要。

第 1、2 步對 ASH 本身也有好處，可以先做。第 3 步以後，等真的要開變體再動。
