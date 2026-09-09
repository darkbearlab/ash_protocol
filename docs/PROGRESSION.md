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

單局已升為 v6，舊 v1–v3 會遷移彈種並保留總量，詳見 [AMMUNITION.md](AMMUNITION.md)；既有地圖保持不變。舊存檔缺少原始局次 ID，採 `legacy-種子` 固定識別以防重複匯入刷點。因此升級前同種子的不同歷史存檔會共用累積上限；升級後新局沒有此限制。

## 接入武器與角色

新武器只能附加到 `WEAPONS`，不可重排既有索引。可選武器加穩定 `unlockId`，購買後把該 ID 加入 profile.unlocks.weapons。現有六把武器沒有 unlockId，永遠可用。

新局由 controller 將解鎖列表傳給 `new Game(seed, ids, carryingLevel)`，存入 `unlockedWeapons` 快照；繼續舊局保留當時快照。`weaponUnlocked()` 提供資格判定，敵人武器掉落會檢查；軍械箱在有可選解鎖武器時以 25% 機率從中抽取，否則沿用各層保證武器。現階段沒有任何付費解鎖武器，所以六把既有武器流程不變。

角色先保留 profile.unlocks.characters 的穩定 ID 容器。未來還需實作角色定義、選擇畫面、局次角色快照與存檔遷移；此版不假裝已具備角色技能。

攜行消費已由 purchaseCarrying 實作，同次 profile 寫入扣款及 upgrades.carrying。未來武器／角色扣款及解鎖也應在同一次 profile 寫入完成，驗證餘額與已解鎖狀態；不要把廢料改成跨局點數，也不要讓解鎖直接替代局內取得武器的流程。

全局 upgrades.carrying 為六鍵物件，每種 0–3 階，分別花 20／40／70 點。profile v2 補六種 0；v3 整組升級先退還舊費用再歸零，v4 不重複退還。單局匯入不帶入等級；完整備份替換整份等級與餘額。詳細原子寫入與上限見 [AMMUNITION.md](AMMUNITION.md)。

放棄本局保留點數與永久升級，記為 history.outcome=abandoned；重新部署亦走相同結算。只有使用者確認「重置遊戲進度」才清空全局資料及去重紀錄，另留完整備份。
