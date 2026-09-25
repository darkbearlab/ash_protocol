# 敵人資料解耦（規格，2026-09-14）

- 狀態：**已完成。** 3.77.0 規則層由 Codex 完成，因自動核准審查容量不足，由 Claude 代為提交；3.77.1 外觀與介面由 Claude 完成（第 9 節）。
- 目的：**在完全不改變遊戲規則的前提下**，把敵人身分從程式裡寫死的兵種名稱，搬到可以擴充、可以分類的資料上。後續 [FACTIONS.md](FACTIONS.md) 的派系框架（第 7、9 節）要蓋在這個結構上。
- 使用者決定（2026-09-14）：先做資料解耦，再做派系；這一輪不改任何規則。

## 1. 範圍

**要做**：

- 敵人定義補上分類欄位與規則屬性欄位（第 4 節），規則層改讀資料，不再判斷兵種名稱。
- 出生池、增援、巢穴產物等「用哪個兵種」的選擇集中成資料表。
- 提供規則層查詢函式，並用測試守住：資料格式，以及「程式不得再用兵種名稱判斷身分」。

**不做**：

- 不新增或刪除兵種、派系、詞條，不調任何數值。
- 不改兵種代號（`rifleman`、`boss` 等）。存檔、測試、QA 場景都靠這些代號。
- 不改生成時亂數的消耗順序。存檔格式與版本原則上不改（見第 2 節第 4 條的例外）。
- 不改名稱與說明文字。雖然都是暫定，但改寫留到派系階段。

## 2. 不變條件（驗收標準）

1. **規則完全不變**：數值、AI 決策、命中、掉落、生成都一樣，亂數消耗的次數與順序也一樣。
2. **`npm test` 全數通過，而且不改既有測試的期望值。**
   - 新增測試可以。
   - 如果某個既有測試直接讀了被搬走的內部常數，只能改它的讀取位置，並在報告裡逐一列出。
3. **`node qa/enemy-data-identity.mjs` 與已提交的基準完全一致**（第 6 節）。
4. **存檔相容**（本輪原則）：
   - 存檔版本不變；`qa/fixtures` 裡所有場景都能照常還原。
   - 敵人實例上的被動來源字串照舊（例如 `enemy:rifleman`）。
   - 起始被動的排列順序照舊。
   - **例外**：使用者表示不介意舊存檔無法沿用（2026-09-14）。但第 6 節的檢查以地圖與存檔內容的雜湊為準，改動實例資料會讓比對分不出「規則變了」還是「資料形狀變了」。所以請先在不改實例資料的情況下完成解耦並通過檢查。若之後確實需要改實例資料（例如派系階段在敵人身上加欄位），另開一個提交：升級存檔版本、放棄舊存檔，確認規則沒變之後再重錄基準。
5. **畫面不變**：Claude 在第 7 節的介面批次中，用瀏覽器比對。

如果某一處無法在不改行為的情況下搬遷，就先保留原樣，並在報告中列出原因，不要為了搬遷而改行為。

## 3. 現況盤點

以 12 個兵種代號的字面值搜尋 `src/`，共 116 處，其中約 35 處其實是友軍種類或瞄準模式，不是敵人身分（見 3.8）。行號以 3.76.5 為準。

### 3.1 頭目級判斷（`['boss','warden']` 反覆出現）

| 位置 | 作用 |
| --- | --- |
| game.js:106 | `bossAlive`：頭目是否存活 |
| game.js:512 | 擊殺廢料：頭目 35，其他 3 |
| game.js:520 | 擊殺頭目發協定點數 |
| world.js:48 | 生命值不隨樓層加成 |
| world.js:127 | 舊版無盡精英不抽頭目 |
| map-population.js:4 | 不能當任務指定目標 |
| melee-classes.js:39 | 鉤鎖對頭目改成衝刺 |
| throwables.js:27 | 震撼彈的失能回合數較短 |
| allies.js:64、116、309 | 不能被召喚 |
| renderer.js:338 | 畫面放大（交 Claude） |

### 3.2 起始被動與原生抗性

- traits.js:46–51 `startingTraits`，依兵種寫死：
  - 無人機：不利用掩體；破壞者：大型；獵犬：第 4 層起快速。
  - 遊蕩者：緩速、不利用掩體；幼蟲：快速、不利用掩體。
  - 狙擊手：夜視；封鎖官：紅外線。
  - 破壞者、封鎖官、頭目：壓制抗性。
  - 最後依 `mechanical` 旗標加上生物或機械。
- suppression.js:4 `grantNativeResistance`：再寫死一次破壞者、封鎖官、頭目的原生抗性（用於遷移時補上）。

### 3.3 行為與戰鬥特例

| 位置 | 作用 |
| --- | --- |
| enemy-behavior.js:32 | 會撞破障礙的兵種：獵犬、破壞者、自爆體、頭目 |
| enemy-behavior.js:38 | 封鎖官呼叫的增援是無人機 |
| enemy-behavior.js:48 | 狙擊手打原地的紀錄與特效 |
| enemy-behavior.js:66–71 | 行為樹按兵種註冊：狙擊手、頭目、封鎖官、自爆體、遊蕩者、幼蟲 |
| enemy-behavior.js:18 `ENEMY_WEAPONS` | 持槍兵種每次射擊的發數 |
| enemy-affixes.js:6 | 「持槍」兵種：步槍、突擊、哨兵、狙擊，決定武器類詞條能不能抽 |
| game.js:152 | 無人機可以越過實體格 |
| game.js:595 | 攻擊特效：獵犬爪擊、破壞者揮砍、機械電漿、其他子彈 |
| game.js:611 | 狙擊手鎖定格被佔據的判定 |
| game.js:639、641 | 無人機（敵我皆同）不受地面危害 |

### 3.4 生成與增援

| 位置 | 作用 |
| --- | --- |
| world.js:124 | 出生池。前兩層一組、之後一組；**陣列順序與重複次數就是亂數抽取的位置** |
| world.js:155 | 起始房間的斥候固定是步槍兵 |
| data.js:31、34 `FLOORS[].boss` | 各層頭目（已經是資料） |
| endless.js:11 `ENDLESS_TUNING.heavyExtra` | 無盡模式額外加入出生池的兵種（已經是資料） |
| runtime-enemies.js:24、41、48、51 | 執行期雜兵是遊蕩者；巢穴產物是幼蟲；兩者的存檔驗證 |
| retreat.js:44、68 | 撤退增援是步槍兵與突擊兵，以及驗證 |

### 3.5 掉落

- data.js:11 `ENEMY_LOOT`：按兵種的掉落表（已經是資料，但與兵種定義分開存放）。

### 3.6 外觀與演出（交 Claude，第 7 節）

- presentation.js:41、47：各兵種的彈道武器對照；獵犬用爪擊特效。
- renderer.js：
  - 43：圖集名稱。
  - 139、281：屍體圖（遊蕩者借用步槍兵、幼蟲借用獵犬、哨兵借用步槍兵）。
  - 338–341：精靈圖借用、大小與放大比例。
  - 154、155、347、370：狙擊手的瞄準線顏色與倒數數字。
  - 355–367：沒有圖時的程式繪製。

### 3.7 介面（交 Claude，第 7 節）

- controller.js:105：威脅清單中狙擊手鎖定格的判斷。
- controller.js:433：圖鑑圖示（頭目 Ω、無人機 ◇、其他 !），以及獵犬的「第 4 層起：快速」註記。
- callout-ui.js:24：喊話的生物聲線名單。

### 3.8 友軍撞名（不是敵人身分耦合）

- 友軍用 `kind`（`drone`、`pet`、`summon`、`survivor`）區分種類；控制器的瞄準模式也叫 `drone`。這些字面值不屬於本規格的搬遷對象。
- 但友軍的 `type` 會借用敵人兵種的數值與外觀：寵物用 `crawler`，機體用 `drone`，召喚物沿用屍體的兵種。以下三處屬於耦合，要一起搬：
  - allies.js:64、309：機體必須是 `drone`。
  - allies.js:111：寵物用 `crawler`。
  - allies.js:59：機體武器是電漿。

### 3.9 可以保留的字面值

- **資料表本身**：兵種定義、第 4 節的出生表、`FLOORS[].boss`、`ENDLESS_TUNING.heavyExtra`。
- **舊存檔遷移**：例如 game.js:873 把舊存檔第 3 層的 `boss` 改成 `warden`。遷移描述的是歷史狀態，保留原樣，加註解標明。
- **測試、QA、工具**：分別有 354、254、12 處字面值。兵種代號不改，所以不受影響。

## 4. 目標資料結構

原則：**保留現有的平面欄位**（`hp`、`damage`、`range`、`armor`、`xp`、`expendable`、`fragile`、`rapid`、`seekCover`、`mechanical`、`name`、`role`、`color`），不做巢狀重整，避免牽動上百處讀取。只**新增**下面這些欄位；沒寫的欄位取預設值，所以結果和現在一樣。

### 4.1 分類標籤 `tags`

封閉集合 `ENEMY_TAGS`，測試檢查不得出現未知標籤。

| 標籤 | 兵種（現況） | 取代的判斷 |
| --- | --- | --- |
| `boss` | 封鎖官、核心守衛 | 3.1 全部 |
| `armed` | 步槍兵、突擊兵、哨兵、狙擊手 | 武器類詞條適用（enemy-affixes.js:6） |
| `breaker` | 獵犬、破壞者、自爆體、核心守衛 | 撞破障礙（enemy-behavior.js:32） |
| `flying` | 無人機 | 越過實體格、不受地面危害（game.js:152、639、641，敵我共用） |

`expendable` 已經是資料欄位，照舊使用，不另外做成標籤。

### 4.2 規則屬性

| 欄位 | 意思 | 取代的判斷 |
| --- | --- | --- |
| `traits` | 起始被動代號陣列，不含生物或機械 | traits.js:46–51、suppression.js:4 的名單 |
| `floorTraits` | 依樓層取得的被動，例如 `[{id:'fast',minFloor:4}]` | traits.js:46 的獵犬 |
| `behavior` | 行為樹代號，預設等於兵種代號 | 讓之後的派系變體共用同一棵樹 |
| `rounds` | 每次射擊的發數 | `ENEMY_WEAPONS` |
| `attackStyle` | 近戰或射擊命中玩家時的特效：`claw`、`slash`、`plasma`、`bullet` | game.js:595 |
| `reinforcement` | 行為樹呼叫增援時產生的兵種，例如封鎖官的 `drone` | enemy-behavior.js:38 |
| `flashlight` | 3.181.0：`'some'` 的人類約三分之一帶手電筒（種子、樓層與編號的雜湊），`'always'` 一定帶（小隊長、督戰官）；感染者與替蟲族作戰的不帶。見 docs/LIGHTING.md | 取代 `e.type==='brute'` 這類名稱判斷 |
| `loot` | 掉落表，從 `ENEMY_LOOT` 搬進兵種定義 | data.js:11。`ENEMY_LOOT` 可以保留成由定義推導的唯讀檢視，維持相容 |

`startingTraits(type,floor)` 的輸出必須與現在**逐項相同，包含順序**：先放 `traits`，再放符合樓層的 `floorTraits`，最後放生物或機械。被動來源仍是 `enemy:${type}`。

### 4.3 出生資料表 `ENEMY_SPAWNS`

```js
// 陣列順序與重複次數就是亂數抽取的位置，任何改動都會讓同種子地圖不同。
ENEMY_SPAWNS = {
  legacyEarly: ['rifleman','rifleman','raider','gunner','drone','crawler'],            // floor <= 2
  legacyLate:  ['rifleman','rifleman','raider','raider','gunner','drone','brute','sniper','bomber'],
  scout: 'rifleman',
  retreatWave: ['rifleman','raider'],
  runtimeFodder: 'fodder',
  nestChild: 'brood',
};
```

無盡模式的 `heavyExtra` 與各層頭目維持在原本的資料位置。

### 4.4 查詢函式（規則層，建議放 `src/enemy-data.js`）

| 函式 | 用途 |
| --- | --- |
| `enemyDef(typeOrActor)` | 取得兵種定義 |
| `hasEnemyTag(typeOrActor, tag)` | 是否帶有某個標籤 |
| `isBossClass(actor)` | 等於 `hasEnemyTag(actor,'boss')` |
| `enemyStartingTraitIds(type, floor)` | 產生起始被動代號 |

友軍借用兵種同樣走這些查詢；召喚排除改讀 `boss` 標籤與 `mechanical`。

### 4.5 外觀與介面欄位（Claude 在第 7 節新增，Codex 不必處理）

| 欄位 | 內容 |
| --- | --- |
| `sprite` | 圖集鍵、屍體圖、大小、放大比例、沒有圖時的繪製方式 |
| `projectile` | 演出用的彈道武器 |
| `telegraph` | 倒數或「!」 |
| `glyph` | 圖鑑圖示 |
| `voice` | 喊話聲線；派系階段會改由派系決定 |

### 4.6 保留給派系階段

`faction` 欄位**這一輪不加**。規劃好的位置在 `tags` 旁邊，由 FACTIONS.md 第 7 節定義。

## 5. 守門測試（Codex 新增）

1. **資料格式**：
   - 每個兵種的 `tags` 只能用 `ENEMY_TAGS` 裡的標籤。
   - `traits`、`floorTraits` 的代號必須存在於 `TRAITS`。
   - `behavior` 必須有註冊的行為樹，或使用預設樹。
   - `loot` 的格式正確。
   - `ENEMY_SPAWNS` 裡的代號都必須存在。
2. **不得再寫死身分**：`src/` 內不得再以兵種代號的字面值判斷敵人身分，例如 `type==='sniper'`、`['boss','warden'].includes(e.type)`。
   - 允許清單：3.9 的資料表與遷移。
   - 友軍的 `kind` 字面值不算。
   - 具體比對方式由 Codex 決定，但要能在有人重新寫死時失敗。
3. **起始被動**：對所有兵種、第 1 到 12 層，新舊 `startingTraits` 的輸出逐項相同。可以直接在測試裡保留一份現況快照。

## 6. 行為一致性檢查（Claude 已提供）

`qa/enemy-data-identity.mjs` 記錄解耦前的遊戲行為，基準檔 `qa/enemy-data-baseline.json` 已隨本規格提交。

- 比對：`node qa/enemy-data-identity.mjs`。有差異時列出並回傳失敗。
- 重新記錄：`node qa/enemy-data-identity.mjs --write`。**只有在確認規則刻意改變時才重寫；本輪不應該重寫。**

涵蓋三類：

1. **地圖生成**：
   - 現行生成器：種子 1–40，第 1–12 層。
   - 舊版生成器：種子 1–40，第 1–6 層。
   - 難度偏移 6：種子 1–10，第 1–6 層。
   - 以上各自記錄整張地圖的雜湊。
2. **任務局面**：每種任務、種子 1–5，建立新局，並載入第 1、3、6 層（無盡模式加第 12 層）後的存檔雜湊。存檔版本號，以及每局隨機產生的結算帳本代號 `runId`，都不計入雜湊。
3. **機器人重跑**：每個職業、種子 1–3，記錄結局、樓層、回合、生命、擊殺、行動數、無效指令數。

## 7. 分工與順序

1. **Claude（已完成）**：本規格、第 6 節的檢查腳本與基準。
2. **Codex**：
   - 第 4.1–4.4 節的資料欄位、出生表、查詢函式。
   - 3.1–3.5 與 3.8 的規則層搬遷。
   - 第 5 節的守門測試。
   - 跑 `npm test` 與第 6 節的檢查，並在報告中列出無法搬遷的位置與原因。
3. **Claude（Codex 之後）**：
   - 第 4.5 節的外觀與介面欄位，以及 3.6、3.7 的搬遷：renderer、presentation、controller 的圖鑑與威脅清單、喊話聲線。
   - 同樣跑第 6 節的檢查，並用瀏覽器比對畫面。

## 8. 交接給 Codex 的重點

- 先讀第 2 節的不變條件。這一輪的成果就是**「程式結構變了，玩起來完全一樣」**。
- 出生池的陣列順序、起始被動的順序、被動來源字串，都會直接影響同種子結果與存檔，務必保持。
- 第 6 節的基準不應該被重寫。如果比對不一致，代表行為變了，要找出原因，而不是更新基準。
- 做不到的地方就保留原樣並列入報告，不要為了搬遷而改規則。

## 9. 實作現況與 Claude 交接（3.77.0）

- `data.js` 的 ENEMY_TYPES 直接持有 tags、traits、floorTraits、behavior、rounds、attackStyle、reinforcement、loot；沒有必要的可選欄位省略，沿用預設。原平面數值、兵種與定義順序均保留。
- `enemy-data.js` 匯出第 4.4 節四個查詢，以及 ENEMY_TAGS、ENEMY_SPAWNS、ALLY_BASE_TYPES。全部由 engine.js 再匯出；只讀定義，不往敵人實例加入欄位。
- ENEMY_SPAWNS 的兩個出生池凍結，生成時複製後才追加無盡 heavyExtra，原順序與重複權重不變。撤退第二隻以後仍取 retreatWave[1]，沒有改為輪替抽選。
- ALLY_BASE_TYPES 為 `{drone:'drone',pet:'crawler'}`，用於友軍建立／型別驗證與借用機體武器的判斷。機體仍只接受指定底型，不能將原本禁止的其他機械型別納入。召喚池仍讀 **實例 activeTrait(mechanical)**，保持被動能改變召喚資格的語意。
- 起始被動由 enemyStartingTraitIds 依 traits → 符合 floorTraits → 生物／機械產生；startingTraits 的來源仍為 enemy:${type}。遷移補抗性改讀定義 traits，沒有改來源或欄位。
- unitTree 先讀定義 behavior，未指定時沿用 type；未註冊就使用原通用空樹。註冊鍵沿用原字串（它們現在是可共用的行為 ID），不改節點執行或 RNG。狙擊手的占格目標判斷讀 fixedTile。
- ENEMY_LOOT 保留相同鍵順序的唯讀相容檢視，值引用 ENEMY_TYPES 的 loot；Game 掉落直接查定義。ENEMY_WEAPONS 也保留由 armed 定義推導的相容檢視，射擊規則直接讀 rounds。
- save **39**、profile **5**、backup **1**、地圖世代 **10** 全部不變。敵人實例、序列化、舊檔資料、起始被動來源字串不變；這批沒有存檔遷移。

### 明確保留的位置

1. `game.js` 的 `version===1` 區塊：第三層 boss → warden 是歷史 ID 遷移，保留原文並加註解，不能改用現在的分類推導歷史。
2. `enemy-behavior.js` 的 spentCase 對照表，以及固定落點射擊的 `attackerType:'sniper'`：屬演出 payload／彈殼素材，保留完全相同的內容，交外觀批次處理；規則判定已讀 unitTree.fixedTile。
3. `renderer.js`、`presentation.js`、`controller.js`、`callout-ui.js` 的兵種外觀／介面特例：依 3.6、3.7 留給 Claude；本批沒有改這四個檔案。
4. FLOOR_INFO 的 boss、ENDLESS_TUNING.heavyExtra、行為樹註冊鍵、資料表本身：已屬資料，沿用原處。友軍 kind、技能 ID、物件 nest 與瞄準模式不是敵人兵種判斷。

沒有因為行為差異而放棄任何本批規則層搬遷；上列保留項為歷史語意、既有資料或明確不在範圍的外觀。

### 守門與驗收

新增 tests/enemy-data.test.mjs：資料與引用合法性、所有原兵種 1～12 層的被動／來源快照、新代號共用定義／行為而不改實例欄位、直接／反向比較與 inline includes 名單的語法守門。守門略過上述四個待遷 UI 檔與 game.js 精確的 v1 遷移行；Claude 每完成一個 UI 檔請移除對應例外。它是針對常見硬編碼語法的守門，未宣稱可辨識任意變數別名或動態組字。

解耦前後 `node qa/enemy-data-identity.mjs` 均與已提交基準一致：780 張生成地圖、110 份任務局面、24 次機器人重跑。本輪未改基準、檢查腳本或任何既有測試。完整結果與發布紀錄見 `qa/results/2026-09-14-codex-3.77.0-enemy-data.md`。

### Claude 外觀與介面接線（3.77.1，已完成）

**新增欄位**：寫在 `data.js` 的兵種定義裡，只給演出與介面讀取，規則層不讀。

| 欄位 | 內容 | 目前使用 |
| --- | --- | --- |
| `sprite` | `key` 圖集格（預設為兵種代號）；`corpse` 屍體圖（預設同 `key`）；`size` 精靈圖倍率；`scale` 沒有圖時的繪製倍率 | 遊蕩者、哨兵借用步槍兵；幼蟲借用獵犬；封鎖官與核心守衛放大 1.15 |
| `drawing` | 沒有圖時的形狀 `humanoid`／`critter`／`drone`，以及 `color`、`glow`、`heavy`（護肩）、`longBarrel`（長槍管） | 獵犬、自爆體為蟲形；無人機；破壞者、封鎖官、核心守衛有護肩；狙擊手有長槍管 |
| `projectile` | 敵人射擊的演出武器，對應 `WEAPON_VISUALS` | 沒填時沿用步槍 |
| `casing` | 射擊後留下的彈殼痕跡 | 步槍兵、突擊兵、哨兵、狙擊手 |
| `glyph` | 圖鑑圖示，預設「!」 | 無人機 ◇、核心守衛 Ω |
| `voice` | 喊話聲線；機械仍由 `mechanical` 決定 | 遊蕩者、幼蟲、獵犬、自爆體為 `creature` |

**查詢函式**：`src/enemy-visuals.js` 匯出以下內容。

- 外觀：`enemySprite`、`enemyDrawing`、`enemyProjectile`、`enemyGlyph`、`enemyVoice`。
- `enemyMeleeStyle`：讀規則欄位 `attackStyle`，決定近戰是爪擊還是揮砍。
- `floorTraitNote`：產生圖鑑的「第 N 層起」註記。
- 圖集名稱清單 `SPRITE_NAMES`、`AFTERMATH_NAMES`：**只能往後加，不能重排**，順序就是圖片的格子位置。

**搬遷**

| 檔案 | 改讀 |
| --- | --- |
| renderer | 精靈圖、大小、屍體圖、沒有圖時的繪製改讀上表；狙擊手的倒數數字與瞄準線改讀 `unitTree(e).fixedTile` |
| presentation | 彈道武器讀 `projectile`；近戰爪擊讀 `attackStyle` |
| controller | 威脅清單讀 `fixedTile`；圖鑑圖示讀 `glyph`；「第 N 層起」註記由 `floorTraits` 產生 |
| callout-ui | 生物聲線讀 `voice` |
| enemy-behavior（Codex 暫留的兩處） | 彈殼讀 `casing`；固定落點射擊的 `attackerType` 改為 `e.type` |

守門測試的 `deferred` 已清空。`src/` 內已經沒有以兵種代號判斷身分的地方，只剩 game.js 的 v1 歷史遷移例外。

**驗收**

- `npm test` 752/752。新增 tests/enemy-visuals.test.mjs 3 項：
  - 以 3.77.0 寫死的對照表為快照，逐兵種比對新資料。
  - 檢查資料引用的圖集格、繪製形狀、彈道都存在。
- `node qa/enemy-data-identity.mjs` 與基準一致。
- **繪製比對**：在 3.77.0 與 3.77.1 各跑一次，記錄每個兵種的全部畫布呼叫，兩份完全相同（2529 次，雜湊一致）。涵蓋角色（有圖／沒圖 × 一般／蓄勢／失能）與屍體。
- 唯一刻意差異：遊蕩者與幼蟲的屍體，現在有和其他兵種相同的 0.14 秒倒地位移。
- 詳見 [3.77.1 QA](../qa/results/2026-09-14-claude-3.77.1-enemy-visuals.md)。

**派系階段可以直接用**：新兵種或變體只要在定義裡填外觀欄位，renderer 與介面都不必改程式。
