## 最新驗收：3.45.0 — 通用升級

`?test=1&v=3.45.0`；執行 `node qa/create-3.45-fixtures.mjs`，匯入 qa/fixtures/3.45/。Codex 未做瀏覽器／手機測試。前批步驟保存在 docs/archive/verification-notes-3.44.md。

1. three-picks：連選三次，每次保存與重開保持當次選項；不同序號重新抽（偶然重複合法），選完才能行動。卡片顯示階數，長文可捲、不推高戰場。
2. rank-three：精準射擊顯示 2/3→3/3，選後不再出現；生命／裝甲是兩項。非法 ID 已由引擎測試覆蓋。
3. supply-fallback：全部永久項滿階，只顯示一項戰地補給，連選兩次可正常回戰場。此為人工 UI 狀態，不作戰力依據。
4. legacy-v27：保留 HP70、上限150、舊 bonus24、裝甲3；推回 damage4／health2／armor1，damage 不再出現。不要重置正式資料。
5. 自然局觀察十一項選擇、已選項較常回來、命中與閃避手感、新武器增幅對不同連發武器的收益；並非每次保證出已選項，補給不加權。職業專屬與主選單 UPGRADES 未實作。
