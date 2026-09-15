## 最新交付：3.87.0–3.88.0 — Kill house（規則、美術與介面）

- 模擬不存中途，不覆蓋原戰役。先保存一局戰役，再測 tutorial / arcade 的開始、跳過、結束、放棄與完整備份。單局匯入／匯出不能用模擬資料。
- `createKillhouse({mode:'tutorial'})` 固定士兵六房、9 名人形（3.88.1 起只有一名研究員）。第 0 房在建立時發事件，其餘每房一次。缺敵／道具或次序問題請回報。
- `createKillhouse({mode:'arcade',character:'recon',seed:0})` 與 seed1 覆蓋兩配方；先有 7×7 整備層。整備不計分，走入出口進戰鬥，不額外回血／補彈。
- 街機不加經驗／掉落，沒有頭目或蟲族來源；殺研究員會提高肅清率。模擬結果讀 g.simulationResult；分數權重由 Claude 接。
- 檢查新地板、牆面／頂板、門四狀態、掩體圖，以及手機離線載入。現有設施使用原圖與原繪製序列。
- **3.88.0（Claude）**：主選單 KILL HOUSE、NEW GAME 前的首次訓練詢問、每區提示卡、青色全息人形、「銷毀此庫存」與街機分數 v1 都已接上，Claude 也獨立驗證了 3.87.0。實機請走：開始、跳過與結束模擬後回到原戰役；教學完成與陣亡；街機完成後的最高分。報告見 [3.88.0](qa/results/2026-09-15-claude-3.88.0-killhouse-ui.md) 與 [3.87.0 驗證](qa/results/2026-09-15-claude-3.87.0-verify-killhouse.md)。
- **3.88.1（Claude）**：教學卡片改在開門前那一格出現（第 2 區在走廊第一格）；第 5 區只留左邊一名研究員，不會再開門放出第 6 區的敵人。報告見 [3.88.1](qa/results/2026-09-15-claude-3.88.1-tutorial-cues.md)。
- **3.88.2（Claude）**：模擬訓練結束時，狀態一律顯示「篩選合格」、備註「後續績效尚待評估」，不再顯示肅清分級。報告見 [3.88.2](qa/results/2026-09-15-claude-3.88.2-tutorial-screening.md)。
- [規格及介面契約](docs/KILLHOUSE.md)、[QA 報告](qa/results/2026-09-15-codex-3.87.0-killhouse.md)、[上一批封存](docs/archive/verification-notes-3.86.0.md)。
