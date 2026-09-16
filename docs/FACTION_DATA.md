# 派系清單與設施派系（規格，2026-09-14）

- 狀態：**3.78.0 規則層完成。** 介面部分由 Claude 接手（第 9 節）。
- 目的：建立派系框架。**第一步只有一個「現行混合」派系（大鍋炒）**，內容等於現在的出生表，玩法完全不變。確認整套機制運作後，下一輪才分家（使用者決定）。
- 依賴：[ENEMY_DATA.md](ENEMY_DATA.md)（3.77 已完成的敵人資料解耦）、[FACTIONS.md](FACTIONS.md)（派系設計討論）。

## 1. 範圍

**要做**：

- 派系清單 `FACTIONS`（資料）與查詢函式。
- **設施派系**：建立新局時決定，存在整局存檔裡，換層沿用。
- **敵人派系**：敵人出生時記上所屬派系。
- 出生池、各層頭目、斥候、撤退增援、執行期雜兵、蟲巢產物，改讀設施派系的清單。
- 派系的**詞條權重**欄位（可選；沒填就沿用現在的均勻抽選）。
- 派系的**覆寫**欄位：同一張兵種卡在該派系下的名稱、說明、塗裝、聲線。
- 3.103.1：忠誠者與叛軍各有一份名稱覆寫（`LOYALIST_NAMES`／`REBEL_NAMES`）。忠誠者寫職務（步槍兵、突擊兵、破門手、狙擊手、軍犬），叛軍在同一個詞前加「叛變」；忠誠者的裝甲版與叛軍的精英版刻意沿用各自派系的同名。頭目兩派共用，`legacy` 不覆寫。
- 喊話事件帶上派系代號。
- **通用染色能力**（介面）：之後派系換皮與小菁英都會用到。

**不做**：

- 不新增派系：只有 `legacy`（現行混合）。不新增兵種，不調任何數值。
- 不分家，也不移除蟲巢或自爆體。這些是下一輪。
- 不做小菁英的生成規則，另開規格：[ELITE_ENEMIES.md](ELITE_ENEMIES.md)，排在本規格之後。
- 不做派系互打（擱置）。

## 2. 不變條件（驗收標準）

1. **規則不變**：出生內容、頭目、地圖與詞條的亂數消耗順序，都和 3.77.1 相同。
2. **`npm test` 全數通過**，不改既有測試的期望值（新增可以）。
3. **`node qa/enemy-data-identity.mjs` 與既有基準一致。**
   - 檢查腳本已在計算雜湊前忽略 `faction`、`facilityFaction` 兩個欄位（第 6 節）。所以新增這兩個存檔欄位不需要重錄基準；**本輪不可以重錄**。
4. **存檔**：可以升級存檔版本，使用者允許舊存檔不沿用。仍建議做簡單遷移：舊存檔的設施與敵人一律視為 `legacy`。
5. **畫面不變**：`legacy` 不顯示派系標籤，不覆寫名稱、塗裝或聲線。

## 3. 派系清單結構

建議放在 `src/factions.js`：

```js
export const FACTIONS = {
  legacy: {
    name: '現行混合',   // 內部名稱
    tag: false,        // false = 目標卡不顯示派系標籤
    roster: {
      // 每個區段是「有順序的 [兵種代號, 份數]」清單，依序展開成抽取陣列。
      // 展開後的順序與重複次數就是亂數抽取的位置，必須和 3.77.1 的 ENEMY_SPAWNS 逐項相同。
      early:     [['rifleman',2],['raider',1],['gunner',1],['drone',1],['crawler',1]],                    // 第 1–2 層
      late:      [['rifleman',2],['raider',2],['gunner',1],['drone',1],['brute',1],['sniper',1],['bomber',1]], // 第 3 層起
      deepExtra: [['brute',1],['sniper',1],['bomber',1]],   // 第 7 層起追加在 late 之後（原 ENDLESS_TUNING.heavyExtra）
    },
    bosses: { 3: 'warden', 6: 'boss' },   // 以 floorInfo 的 cycleFloor 對應，無盡模式照樣循環
    scout: 'rifleman',                    // 起始房間的斥候
    retreatWave: ['rifleman','raider'],   // 撤退增援：第一隻用 [0]，其餘用 [1]
    fodder: 'fodder',                     // 執行期雜兵
    nestChild: 'brood',                   // 蟲巢產物（地洞與傳送門兩種外觀都用它）
    // affixWeights: { 詞條代號: 權重 }   未填 = 沿用現在的均勻抽選（第 7 節）
    // overrides: { 兵種代號: { name, role, tint, voice } }
    // voice: 聲線代號                    未填 = 沿用兵種卡的聲線（第 8 節）
  },
};
```

- **樓層區段**：`early` 為第 1–2 層，`late` 為第 3 層起，第 7 層起在 `late` 後追加 `deepExtra`。這與現在 world.js 的寫法相同，用的是實際樓層數，不是循環樓層。
- **單一來源**：各層頭目目前寫在 `FLOOR_INFO[].boss`，`ENEMY_SPAWNS` 在 enemy-data.js。搬進派系清單後，舊位置要刪除，或改成由 `legacy` 推導的相容檢視。**不要留下兩份可以各自修改的資料**。Codex 決定做法並寫進報告。

## 4. 查詢函式（規則層）

| 函式 | 用途 |
| --- | --- |
| `factionDef(id)` | 取得派系定義 |
| `pickFacilityFaction(seed, mission)` | 決定這一局的設施派系。**目前只有一個派系，固定回傳 `legacy`，不耗任何亂數。** 之後有多個派系時，用獨立雜湊決定，不動地圖亂數 |
| `factionPool(id, floor)` | 展開該樓層的出生抽取陣列 |
| `factionBoss(id, cycleFloor)` | 該循環樓層的頭目 |
| `enemyFaction(e)` | 敵人所屬派系 |
| `factionOverride(e)` | 該敵人在所屬派系下的覆寫（沒有就回傳空物件） |
| `enemyBaseName(e)` | 覆寫名稱，沒有就用兵種卡名稱。`enemyDisplayName` 改用它當基礎名 |

**生成的傳遞路徑**：`generate(seed, floor, unlocks, offset)` 需要多一個派系參數，預設 `legacy`。`Game.generateFloor` 傳入 `this.facilityFaction`。所有由生成、增援、巢穴、撤退產生的敵人，都帶上這個派系。

## 5. 敵人實例與存檔

- **敵人**：新增字串欄位 `faction`，出生時等於設施派系。以下全都適用：地圖生成、執行期雜兵、蟲巢產物、撤退增援、封鎖官叫出的無人機。
- **整局**：新增 `facilityFaction`，建立新局時決定並保存。
- **存檔版本 39 → 40**：
  - 遷移：缺少的欄位補上 `legacy`。
  - 驗證：值必須是 `FACTIONS` 裡的代號。
  - `qa/fixtures` 裡的舊版場景要能透過遷移讀取。
- **召喚物**：死靈法師把屍體變成友軍後，友軍不需要派系。保留或移除這個欄位由 Codex 決定，並寫進報告。

## 6. 行為一致性檢查（Claude 已更新）

- `qa/enemy-data-identity.mjs` 在計算雜湊前，會移除任何層級的 `faction`、`facilityFaction` 欄位。更新後重跑，與基準完全一致。
- **分家那一輪**會刻意改變出生內容。屆時要重錄基準，並移除這條忽略規則。

## 7. 詞條權重

- 欄位：`affixWeights: { 詞條代號: 權重 }`，可選。
- **沒填**：沿用 `rollEnemyAffixes` 現在的做法，從詞條目錄均勻抽選，亂數消耗完全相同。
- **有填**：Codex 設計加權抽選。仍使用同一個出生亂數，不動地圖亂數，並補上測試。
- 本輪 `legacy` 不填，所以只需要實作並測試加權這條路徑，不影響現有結果。

## 8. 喊話

- **規則層**：`receiveCallout` 產生的事件加上 `faction`，只帶派系代號，不帶兵種。看得到與只聽得到的事件都加。
- **介面（Claude）**：
  - 依 `FACTIONS[faction].voice` 選聲線。
  - 沒填時沿用現在的規則：看得到的用兵種卡聲線，只聽得到的用人類聲線。
  - `legacy` 沒填，所以畫面不變。
- 使用者已確認（2026-09-14）：平時、交戰、牆後都沿用派系聲線，牆後只聽得到的喊話也會透露派系聲線。

## 9. 介面（Claude，在 Codex 之後）

- **派系標籤**：目標卡被動標籤那一行的最前面顯示派系名稱，只有 `tag` 為真時才顯示；`legacy` 不顯示。
- **名稱覆寫**：顯示用的名稱讀規則層的 `enemyBaseName`。
- **染色**：
  - 對敵人圖集格染色，沿用玩家塗裝的染色快取。
  - 顏色來源優先順序：派系覆寫的 `tint`，再來是兵種卡的 `sprite.tint`；都沒有就不染。
  - 之後小菁英會在敵人實例上再疊一層。
- **喊話聲線**：依派系選擇（第 8 節）。
- **台詞清單**：依 FACTIONS.md 第 7 節，把聲線整理成一份清單，派系用代號引用聲線。
- **圖鑑**：暫時不分派系。

## 10. 守門測試（Codex 新增）

1. **派系清單格式**：
   - `roster` 的代號都存在於 `ENEMY_TYPES`，份數是正整數。
   - `bosses` 的代號存在，而且帶有 `boss` 標籤。
   - `scout`、`retreatWave`、`fodder`、`nestChild` 的代號都存在。
   - `affixWeights` 的代號都存在於 `ENEMY_AFFIXES`，權重是正數。
   - `overrides` 的兵種代號都存在。
2. **覆蓋**：每張兵種卡至少被一個派系用到（出生池、頭目、斥候、撤退增援、雜兵、蟲巢產物、增援、友軍借卡，任一處都算），或列在明確的「未使用」清單裡。
3. **`legacy` 等價**：第 1 到 12 層的 `factionPool('legacy', floor)` 與 3.77.1 的出生陣列逐項相同；頭目、斥候、撤退增援、雜兵、蟲巢產物也都相同。
4. **不寫死派系**：`src/` 內不得以派系代號的字面值判斷身分（例如 `faction==='legacy'`），派系清單本身除外。

## 11. 分工與順序

1. **Claude（已完成）**：本規格；行為一致性檢查忽略派系欄位。
2. **Codex**：第 3–8 節與第 10 節的規則層。
3. **Claude**：第 9 節的介面。
4. **之後另開規格**：
   - 分家：忠誠者、叛軍等，會刻意改變出生內容。
   - 小菁英：[ELITE_ENEMIES.md](ELITE_ENEMIES.md)。

## 12. 使用者決定紀錄（2026-09-14）

1. **派系由獨立清單管理**：清單列出派系有哪些單位；兵種卡本身不寫派系。
2. **先大鍋炒**：所有單位放進一個「現行混合」派系，確認運作後再分家。
3. **敵人圖要能染色**：主要用途是小菁英（帶有很多詞條的敵人），不只是派系。小菁英另開規格 [ELITE_ENEMIES.md](ELITE_ENEMIES.md)。使用者已決定：只多加詞條、多給經驗；出現頻率跟著深度走；只靠染色辨認。

## 13. 實作現況／Claude 交接（3.78.0）

- `faction-catalog.js` 是不依賴其他模組的唯一資料來源；`factions.js` 匯出查詢、名稱覆寫、保存驗證與遷移。engine.js 再匯出公開 API。僅有 legacy，pickFacilityFaction 固定回傳預設代號，不讀 RNG。
- `ENEMY_SPAWNS`、`FLOOR_INFO[].boss`、`ENDLESS_TUNING.heavyExtra` 保留 getter 相容檢視，從派系清單推導，不保留第二份出生資料。factionPool 每次回傳新陣列，按原順序展開；區段採實際樓層，頭目採 cycleFloor。
- `generate(seed,floor,unlocks,offset,faction=DEFAULT_FACTION)` 第五參數；generateWithRecipes 第五參數、generateLegacy 第四參數同樣接收派系，遞迴與回退都傳下去。makeEnemy 第七參數為派系。所有正式出生路徑都帶上 faction，設施派系不加入 FLOOR_FIELDS，封存敵人則自然保存自身欄位。**歷史 generateLegacy 回傳仍為 v1 原始資料形狀，不含 faction**，保留既有逐位元組雜湊；正式 generate 與 Game.loadFloor 在邊界補派系。
- save40：新增 game.facilityFaction 與 enemy.faction。舊版缺欄位補 legacy，包含封存敵人；未知代號拒絕。友軍保留 makeEnemy 的派系欄位，但不參與派系判定、敵我判定或 AI。此欄位目前只供敵人顯示使用。
- affixWeights 有設定時，未指定項目權重為 1；依目錄順序累加權重，用原本那一次抽取值選擇。沒有設定時直接保留 floor(draw×pool.length)；不增加抽取，抽到不適用詞條仍照原機制略過。
- `enemyBaseName(e)` 先讀 `factionOverride(e).name`，再讀兵種名稱；enemyDisplayName 已接它。role／tint／voice 的覆寫資料可從 factionOverride 讀取，顯示與染色交 Claude。
- 可見與只聽見的 callout 事件都新增 `faction`；隱藏事件仍無兵種／身分／精確位置。使用者已批准 **tests/real-mode.test.mjs 的欄位清單唯一一處加入 faction**，其餘既有期望值保持不變。沿用 3.76.1 決定：喊話不寫戰鬥紀錄。
- 驗收：原基準 generation 780／missions 110／bots 24 全部相同，未重錄。新增 tests/factions.test.mjs 七項涵蓋格式、全兵種覆蓋、逐層等價、可選加權、跨生成傳遞、存讀／備份、喊話與守門。細節見 qa/results/2026-09-14-codex-3.78.0-factions.md。

### Claude 介面接線（3.79.1，已完成）

- **派系標籤**：`factionTag(e)`（`src/enemy-visuals.js`）在派系 `tag` 為真時回傳派系名稱，目標卡把它放在標籤行最前面；`legacy` 回傳空字串。
- **名稱覆寫**：目標卡與紀錄沿用 `enemyDisplayName`。3.78.0 已經接上 `enemyBaseName`，介面不必另外處理。
- **染色**：
  - `enemyTint(e)` 先讀 `factionOverride(e).tint`，再讀兵種卡的 `sprite.tint`。
  - renderer 的 `enemySprite` 用玩家塗裝的 `tintPixels` 依亮度換色，每個來源圖與顏色快取一張 32×32 格。
  - 沒有顏色、也不是小菁英時，直接走原本的 `sprite()`，繪製呼叫與 3.79.0 逐項相同。
  - 沒有圖時的程式繪製：人形與蟲形改用染色取代原本顏色。
- **聲線**：
  - `VOICE_LINES` 以聲線代號查台詞。`calloutVoice` 先看兵種卡（機械、生物），再看派系的 `voice`，最後是人類。
  - 只聽得到的喊話沒有兵種，直接用派系聲線。
  - 分家時，在 `VOICE_LINES` 加入各派系的台詞即可。
- **尚未處理**：部署時手動選派系、圖鑑依派系分組，都留到分家。（3.80.0：手動選派系已做，圖鑑分組仍未做。）

## 14. 第一次分家（3.80.0，Claude）

依 [FACTIONS.md](FACTIONS.md) 第 10 節第 8–10 項。規則層的預設派系仍是 `legacy`：沒有指定派系的建構、測試、行為一致性基準、機器人與任務都不變，只有新局會抽派系。

### 14.1 派系清單（`src/faction-catalog.js`）

| | 忠誠者 `loyalist` | 叛軍 `rebel` |
| --- | --- | --- |
| 第 1–2 層 | rifleman 2、raider 1、gunner 1、drone 1、crawler 1 | rifleman 1、raider 2、gunner 1、drone 2、bomber_bot 1、crawler 1 |
| 第 3 層起 | rifleman 2、raider 2、gunner 1、drone 1、brute 1、sniper 1、crawler 1 | rifleman 1、raider 2、gunner 1、drone 2、bomber_bot 2、brute 1、sniper 1、crawler 1、raider_elite 1 |
| 第 7 層起另加 | brute 1、sniper 1 | bomber_bot 1、gunner_elite 1 |
| 頭目 | 第 3 層 warden、第 6 層 boss | 同左（placeholder） |
| 偵察、撤退增援 | rifleman；rifleman、raider | 同左 |
| 雜兵、蟲巢 | 無（`fodder`、`nestChild` 為 `null`） | 無 |

- 兩派都有 `pickable:true`；`tag:true`，所以目標卡顯示派系名稱。聲線代號分別是 `loyalist`、`rebel`。
- 兩派都用 `overrides.crawler` 把獵犬改名「警犬」，沿用原圖。
- 數字是第一版，可以直接改這張表。

### 14.2 新兵種卡（`src/data.js`）

- **自爆機器人 `bomber_bot`**：
  - 沿用自爆行為（behavior `bomber`），改為機械：怕 EMP、不受壓制。
  - 借用無人機圖，染成鏽橘色 `#d9894a`。
  - 數值與孢子自爆體相同：生命 30、傷害 30、經驗 1。
  - 孢子自爆體 `bomber` 只留在 legacy，之後給蟲族。
- **必定小菁英卡 `raider_elite`、`gunner_elite`**：
  - 由基礎卡複製，再加上 `elite:true`；名稱、掉落與圖都和基礎卡相同。
  - 規則見 [ELITE_ENEMIES.md](ELITE_ENEMIES.md) 第 9 節。
  - 圖鑑不列出這些卡，免得名稱洩漏身分。

### 14.3 設施派系與部署

- **`rollFacilityFaction(seed)`**：
  - 對 `${seed}:facility-v1` 做 FNV-1a 雜湊，在 `pickable` 派系之間選。
  - 不讀地圖或戰鬥亂數。種子 1–1000 的結果：叛軍 501、忠誠者 499。
- **`new Game(..., options)` 的 `options.facilityFaction`**：
  - `'random'`：用種子抽。
  - 合法的派系代號：直接採用。
  - 沒有給：維持 `pickFacilityFaction`，也就是 legacy。
- **部署第 3 步**：
  - 多一個「FACILITY · 開發用」清單：依種子隨機（預設）、忠誠者、叛軍、現行混合（測試）。
  - `runOptions` 把選擇轉成 `facilityFaction`；快速開局的 `newGame` 預設也是 `'random'`。
  - 正式版要拿掉手動選擇時，只要刪掉這個清單。
- **執行期族群**：派系的 `fodder` 或 `nestChild` 為 `null` 時，不生成雜兵與蟲巢。

### 14.4 台詞

- `VOICE_LINES.loyalist`（前線回報）與 `VOICE_LINES.rebel`（叫罵吆喝）各涵蓋全部 22 種喊話，不含數字。
- 機械與生物單位照舊用兵種卡的聲線；牆後只聽得到的喊話用派系聲線。

### 14.5 出生統計

範圍：種子 1–40，第 1、2、3、4、6、8、9、10、12 層，共 360 層。

| 派系 | 敵人數 | 機器人比例 | 小菁英 | 蟲巢 |
| --- | --- | --- | --- | --- |
| legacy | 12003 | 10.9% | 190 | 320 |
| loyalist | 11283 | 11.9% | 190 | 0 |
| rebel | 11283 | 35.2% | 1233 | 0 |

- **叛軍小菁英**：第 3–6 層每層約 2 隻，第 8–12 層每層約 5–8 隻。
- **忠誠者小菁英**：只有第 9 層起的一般機率，第 12 層每層約 3 隻。
- **調整過一次**：第一版的叛軍深層還有必定小菁英的重裝兵，深層每層約 10 隻，太多，已拿掉。

### 14.6 既有測試期望的修改

理由都是新增兵種卡與派系，不是行為改變。

- tests/factions.test.mjs：派系代號清單加入兩派；`fodder`、`nestChild` 允許 `null`。
- tests/enemy-data.test.mjs：兵種卡清單只比對原本的前 12 張；沒有列入 `ENEMY_LOOT` 的新卡不比對掉落參照。
- tests/enemy-visuals.test.mjs：舊圖對照只跑原本 12 張。
- tests/faction-visuals.test.mjs：`VOICE_LINES` 代號加入兩派；「legacy 沒有染色」只檢查 legacy 會生成的兵種。
- tests/throwables.test.mjs：機械單位清單加入 `bomber_bot`。
- tests/deploy-ui.test.mjs：`runOptions` 多回傳 `facilityFaction`。

### 14.7 沒有做的

- 忠誠方小隊長、叛軍專屬頭目。
- 圖鑑依派系分組、派系專屬的詞條權重、派系染色。

## 15. 叛軍小菁英加量與忠誠者裝甲（3.81.0，Claude）

使用者試玩標準叛軍覺得很簡單，決定：叛軍多一點小菁英、詞條多一點；忠誠者一部分敵人有裝甲 1（[FACTIONS.md](FACTIONS.md) 第 10 節第 11 項）。

### 15.1 資料與規則接點

- **變體兵種卡**（`src/data.js`）：
  - `variantCard(base, patch)` 複製基礎卡，名稱、掉落、圖與行為都相同，再加上 `variantOf` 與修改的欄位。
  - 圖鑑只列沒有 `variantOf` 的卡。
  - `raider_elite`、`gunner_elite`：`elite:true`（3.80.0 的卡改用這個寫法，內容不變）。
  - `rifleman_armored`、`raider_armored`：`armor:1`。
- **叛軍**：
  - 派系欄位 `eliteAffixes:4`。
  - 第 1–2 層出生池加必定小菁英的突擊兵 1；第 3 層起必定小菁英的突擊兵與機槍兵各 1；第 7 層起另加機槍兵 1（和 3.80.0 相同）。
- **忠誠者**：第 1–2 層的步槍兵一半有裝甲；第 3 層起步槍兵與突擊兵各一半有裝甲。機槍兵沒有。
- **規則接點**：`rollEnemyElite` 補詞條時，數量改讀 `factionDef(enemyFaction(e))?.eliteAffixes`；沒有設定時仍是 `ELITE_TUNING.minAffixes`。

### 15.2 裝甲的實際效果（沿用既有規則）

- **傷害**：每次命中扣掉裝甲值，裝甲 1 就是每發少 1 點傷害，最少 1 點。散彈與連射受影響較大。
- **護甲板**：有裝甲的敵人被擊殺時，照既有規則有 20% 機率掉 10 片護甲板（有護甲板升級時更高）。所以忠誠者設施的護甲板補給會變多，和現在的狙擊手一樣。
- **目標卡**：所有有裝甲的敵人（包括重裝兵、封鎖官、核心守衛、狙擊手）都在 HP 的下一行顯示「護甲 N」（放在同一行時，窄卡片會把「護甲」兩個字拆開）；真實模式和 HP 一起隱藏。

### 15.3 出生統計

範圍：種子 1–40，第 1–6、8、9、10、12 層。

| 派系 | 每層敵人 | 機器人 | 有裝甲的人類 | 每層小菁英 |
| --- | --- | --- | --- | --- |
| legacy | 33.1 | 10.6% | 26.6% | 第 9 層起 0.7–2.9 |
| loyalist | 31.1 | 11.7% | 55.0% | 同 legacy |
| rebel | 31.1 | 32.9% | 18.9% | 第 1–2 層約 2.4、第 3–6 層約 4.2、第 8–12 層 6.5–9.4 |

- **「有裝甲的人類」**：包含本來就有裝甲的狙擊手與重裝兵，所以 legacy 也有 26.6%。
- **叛軍小菁英的詞條**：必定小菁英卡是 4 項。深層自然出現、落在無人機或自爆機器人這類非武裝單位上的小菁英只有 2–3 項，因為它們適用的詞條只有 3 種。
- **對照 3.80.0 的叛軍**：第 3–6 層每層約 2 隻、第 8–12 層每層約 5–8 隻，詞條 3 項。
- **調整過一次**：
  - 第一版第 3 層起有 3 張必定小菁英卡，第 3–6 層每層約 6 隻、深層約 10 隻。
  - 第一版忠誠者的機槍兵也有裝甲，人類裡 69% 有裝甲。
  - 兩者都超過「多一點」「一部分」，已減量，並拿掉 `gunner_armored`。

### 15.4 測試

- 既有測試期望沒有修改。
- tests/faction-split.test.mjs 新增 3 項：
  - 叛軍的小菁英數量與詞條數。
  - 變體卡沿用基礎卡；忠誠者只有一部分部隊有裝甲。
  - 目標卡的裝甲顯示與真實模式。

## 16. 蟲族第一步（3.83.0，Claude）

依 [FACTIONS.md](FACTIONS.md) 第 10 節第 13 項。這一步只用資料加兩個小接點；毒液、鉤舌、感染詞條與蟲潮是第二步，見 [SWARM.md](SWARM.md)。

### 16.1 派系 `swarm`

| 項目 | 內容 |
| --- | --- |
| 第 1–2 層 | rifleman_infected 2、raider_infected 1、crawler 1 |
| 第 3 層起 | crawler 2、rifleman_infected 2、raider_infected 2、bomber 1、giant_bug 1 |
| 第 7 層起另加 | giant_bug 1、bomber 1 |
| 頭目 | 第 3 層 hive_beast、第 6 層 hive_matriarch |
| 偵察、撤退增援 | rifleman_infected；crawler、crawler |
| 雜兵、蟲巢產物 | fodder、brood |

- `tag:true`、`pickable:true`。設施派系抽選現在在三個可選派系之間。
- 聲線 `creature`：牆後聽到的喊話是生物叫聲。
- `nestStyle:'burrow'`：蟲巢固定是地洞。
- 覆寫名稱：crawler 為「獵殺蟲」、fodder 為「被感染者」、brood 為「蟲群幼體」。

### 16.2 新兵種卡

- **巨型蟲 `giant_bug`**：
  - 生命 150、傷害 22、裝甲 0、經驗 3。
  - 大型（被射擊命中 +15）、壓制抗性。
  - 獵犬圖放大 1.3 倍並染色。
- **頭目**：
  - 巢穴巨獸 `hive_beast`（第 3 層）：生命 420、傷害 26、放大 1.55 倍。
  - 母巢巨獸 `hive_matriarch`（第 6 層）：生命 600、傷害 30、放大 1.7 倍。
  - 兩者都是頭目標籤、沒有裝甲、純近戰。協定點數比照封鎖官 8、核心守衛 12。
- **被感染槍兵 `rifleman_infected`**：步槍兵的變體。連發 3 發、射擊命中 −35、染成綠色、只掉彈藥不掉武器。
- **被感染突擊兵 `raider_infected`**：突擊兵的變體。連發 4 發、射擊命中 −35、染色、只掉手槍彈。
- 兩種被感染士兵的連發數都達到壓制門檻（3 發），只要命中就會壓制玩家。

### 16.3 規則接點

- **命中修正**：兵種卡的 `combat` 會在 `makeEnemy` 出生時複製成單位的 `combatModifiers`，射擊命中計算本來就會讀。現有兵種沒有這個欄位，所以不變。
- **蟲巢樣式**：`nestStyle(p, faction)`。派系設定 `nestStyle` 時固定樣式；沒有設定時照舊由座標決定。
- **聲線**：派系聲線可以是 `creature`；兵種卡的 `voice` 在 `VOICE_LINES` 裡有定義時優先，例如被感染士兵的 `infected`。
- **圖鑑**：只隱藏和基礎卡同名的變體（必定小菁英、有裝甲）。被感染士兵有自己的名稱，所以會列出。
- **掉落**：現有規則下，不是雜兵也不是增援的敵人本來就有彈藥掉落機率，所以蟲族照常掉資源。蟲卡沒有 `weapon` 欄位，不掉武器。

### 16.4 出生統計（種子 1–40）

| 樓層 | 每層大約 |
| --- | --- |
| 第 1–2 層 | 被感染槍兵 13、被感染突擊兵 6、獵殺蟲 6、被感染者 2 |
| 第 3–6 層 | 被感染槍兵 8、被感染突擊兵 7、獵殺蟲 7、巨型蟲 3.5、孢子自爆體 3、被感染者 2 |
| 第 8–12 層 | 被感染槍兵 8、孢子自爆體 7、巨型蟲 7、被感染突擊兵 7、獵殺蟲 7、被感染者 2 |

- 每層共約 33 名，與現行混合相同；小菁英只在第 9 層起自然出現。
- 調整過一次：第一版的第 1–2 層每層有獵殺蟲約 10、孢子自爆體約 5，近戰太重，已拿掉前期的自爆體並減少獵殺蟲。

### 16.5 測試

- 既有測試：factions 的派系清單加入 swarm；faction-split 的抽選門檻改成三派各至少 45/200；enemy-visuals 的聲線允許 infected；faction-visuals 的聲線清單加入 infected。
- 新增 tests/swarm.test.mjs 5 項。
