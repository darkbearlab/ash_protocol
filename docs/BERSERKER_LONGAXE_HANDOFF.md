# 狂戰士橫持長柄斧：已核准、已本機替換，交由 Claude 發布

> 2026-09-19 Claude 依本文件於 3.136.3 發布：正式 atlas、採用資料夾與本文件隨版本提交，未帶入 `art/sprites/candidates/` 或其他未採用內容；驗證報告見 `qa/results/2026-09-19-claude-3.136.3-berserker-longaxe.md`。以下為 Codex 的交接原文。

2026-09-19。使用者選定雙手分握長柄兩側、腰前橫持斧頭版本；明確要求本次士兵不改，只改狂戰士。

## 已完成

- 本機 `assets/pixel/classes-v1/atlas.png` 已替換狂戰士站姿：index 6，矩形 x=64、y=32、w=32、h=32。
- 逐像素確認只有這個格子改變；士兵、其他職業與全部倒地圖完全不變。沒有改規則、存檔、索引或 renderer。
- 採用原始生成、提示詞、32×32 透明 PNG、Aseprite 工程及處理脚本在 `art/sprites/adopted/berserker-longaxe-2026-09-19/`。`atlas-before.png` 保留本輪替換前快照；checksums.json 記錄來源與採用圖雜湊。
- process.lua 是從 source.png 重製候選的流程；standing.png 是已核准輸出。install.lua 只覆寫正式 atlas 的指定格子，不碰其餘格子。
- Codex 本輪實跑：逐像素範圍檢查通過、art／operator-color／actor-visuals 13 項測試全過，`npm run build` 通過（當時本機 3.136.2）。未升版、未提交、未推送。

## 請 Claude 接手

使用者已批准這張圖，可依 docs/RELEASE.md 發布到 main 與 GitHub Pages。請採下一個可用版本，更新 CHANGELOG 與驗證紙條、檢查範圍並完成提交及部署。

本次只需正式 atlas、上述採用資料夾、此交接文件及必要發版文件。不要帶入 `art/sprites/candidates/` 的士兵精修、狂戰士手工版或其他未採用候選，也不要批次提交其他未追蹤內容。舊 SPRITE_OUTLINE_HANDOFF.md 是上一批採用紀錄，本次不要再依它覆蓋整張 atlas，否則會蓋掉新狂戰士。

素材路徑未新增，SW 素材清單無需增加；正常 bump 刷新快取。正式遊戲染色、暗房與縮放的主觀效果可交使用者抽查。倒地圖依本次範圍保持原樣，未生成新配套。
