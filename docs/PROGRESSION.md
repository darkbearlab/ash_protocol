# 協定點數與未來解鎖接口（3.9.0）

已提供賺取、保存與永久攜行升級消費；武器解鎖商店、角色切換尚未開放。協定點數和本局廢料分開；死亡或重新部署不會扣除已同步的點數。

## 資料與發放

- `Game.runId`：新局使用 UUID（無 crypto 時以時間及隨機字串回退），不使用地圖種子作新局 ID。同種子重開是獨立任務。
- `Game.protocol = {earned, events}`：本局累積與已領里程碑。`awardProtocol(type,id)` 為入口，數值由 `PROTOCOL_REWARDS` 定義。
- 資料 +3、完成樓層 +4、封鎖官 +8、核心守衛 +12、撤離額外 +16。完整六層與全部資料共 78 點；不補發升級前已完成的里程碑。
- `ash-profile` version 4：既有 runs／wins／history 保留，保留 `protocol: {balance, earned}`、`unlocks: {weapons: [], characters: ['operator']}`、`protocolRuns: {runId: {earned, recorded}}`。
- `saveGame()` 保存本局後同步點數；結局先將點數及結果寫入 profile，再移除本局存檔。重複呼叫／同局匯入只補上超過已發放累積值的差額。
- `protocolRuns` 不隨最近十次任務歷史裁切。後續不可直接移除去重紀錄；若要壓縮，需設計同等去重機制。
- QA 使用 `qa-ash-profile`、`qa-ash-save`。正式資料不可用於測試。點數只存在目前瀏覽器；3.3.0 已加入 [完整 profile／錢包備份與還原](PROFILE_BACKUP.md)。原本的「匯出任務」仍僅包含單局，移轉錢包應使用「完整備份」。

## 舊存檔

單局已升為 v9（含角色、戰鬥記憶、被動與預備欄，見 CHARACTERS.md），舊 v1–v3 會遷移彈種並保留總量，詳見 [AMMUNITION.md](AMMUNITION.md)；既有地圖保持不變。舊存檔缺少原始局次 ID，採 `legacy-種子` 固定識別以防重複匯入刷點。因此升級前同種子的不同歷史存檔會共用累積上限；升級後新局沒有此限制。

## 接入武器與角色

新武器只能附加到 `WEAPONS`，不可重排既有索引。可選武器加穩定 `unlockId`，購買後把該 ID 加入 profile.unlocks.weapons。現有六把武器沒有 unlockId，永遠可用。

新局由 controller 將解鎖列表傳給 `new Game(seed, ids, carryingLevel)`，存入 `unlockedWeapons` 快照；繼續舊局保留當時快照。`weaponUnlocked()` 提供資格判定，敵人武器掉落會檢查；軍械箱在有可選解鎖武器時以 25% 機率從中抽取，否則沿用各層保證武器。現階段沒有任何付費解鎖武器，所以六把既有武器流程不變。

角色先保留 profile.unlocks.characters 的穩定 ID 容器。未來還需實作角色定義、選擇畫面、局次角色快照與存檔遷移；此版不假裝已具備角色技能。

攜行消費已由 purchaseCarrying 實作，同次 profile 寫入扣款及 upgrades.carrying。未來武器／角色扣款及解鎖也應在同一次 profile 寫入完成，驗證餘額與已解鎖狀態；不要把廢料改成跨局點數，也不要讓解鎖直接替代局內取得武器的流程。

全局 upgrades.carrying 為六鍵物件，每種 0–3 階，分別花 20／40／70 點。profile v2 補六種 0；v3 整組升級先退還舊費用再歸零，v4 不重複退還。單局匯入不帶入等級；完整備份替換整份等級與餘額。詳細原子寫入與上限見 [AMMUNITION.md](AMMUNITION.md)。

放棄本局保留點數與永久升級，記為 history.outcome=abandoned；重新部署亦走相同結算。只有使用者確認「重置遊戲進度」才清空全局資料及去重紀錄，另留完整備份。

3.12.0：Soldier／Recon 為免費基礎角色，不消耗協定點數、不要求 unlocks.characters；歷史 operator ID 保留。未來付費角色尚未接購買流程，新任務歷史另保存 character。

## 3.33.0：永久升級卡片頁與解鎖佔位（Claude）

升級頁改為方形卡片格狀，分「攜行容量／幹員／武器／投擲物／技能／重置」六區。**只有攜行容量是實際功能**；其餘四區是**靜態佔位展示，一律顯示「已解鎖」，不讀也不寫 profile**，所以之後接真實 gating 時不必先清除假資料。

### 現有解鎖鉤子盤點（Claude 於 3.32.1 基底查核）

| 對象 | 鉤子 | 狀態 |
| --- | --- | --- |
| 武器 | `weaponUnlocked(weapon,ids)` = `!weapon.unlockId \|\| ids.includes(weapon.unlockId)`；接於 `world.js` 地圖保證武器（25% 機率從已解鎖池抽）與 `game.js` 敵人掉落過濾 | **管線完整但空轉**：九把武器沒有任何一把帶 `unlockId`，池永遠是空的 |
| 儲物箱 | 不需另接 —— `containers.js` 只是把 `generate()` 放好的 items 打包，擋住生成即擋住箱子 | 依賴武器鉤子 |
| 角色 | `profile.unlocks.characters`（預設 `['operator']`），`normalizeProfile` 保存、`backup.js` 驗證 | **只有欄位，沒有任何程式讀它擋選角**；六角色目前全免費 |
| 道具／投擲物／技能 | 無 | **完全不存在** |
| 成就 | 無系統；profile 只有 `runs`／`wins`／`bestFloor`／`bestKills`／`history` | **不存在** |

### 交回 Codex 的需求（使用者指定，Claude 未實作）

1. **實際 gating 屬規則層**：把解鎖狀態接進地圖生成／儲物箱池／選角閘門，會改動 `generate()` 與選角流程，依交接文件交回 Codex。
2. **既有玩家不可倒退**：使用者現在六角色與九把武器全部可用。導入解鎖時必須把既有 profile 一律補成已解鎖，或明確與使用者確認。交接文件亦明訂「不自行把使用者已能玩的角色改成付費」。
3. **成就解鎖幹員**：使用者希望**一部分幹員以遊玩成就解鎖**（非協定點數購買）。目前沒有成就系統，需要新增事件記錄與判定；Claude 未評估可行性，僅依指示留下紀錄。
4. 卡片 UI 已預留：`shown(name,hint)` 產生的佔位卡片與真實卡片共用 `.upgrade-card` 樣式，接上真實資料後只需把 `tier/cap/button/locked` 換成實際值。
