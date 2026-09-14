## 最新交付：3.75.0 — 敵人詞條／行為樹／壓制抗性（Codex 規則）

`node qa/create-enemy-affix-scenes.mjs` 產生六份 affix-*.json，以 `?test=1` 從設定匯入。

- hidden：名稱僅一個「？」；快速行動、連射後逐項顯現，不提前顯示被動與先後手。手機片段截斷由 Claude 接。
- prepare：準備中的投彈遭震撼／鉤鎖可取消；單純壓制不能取消。準備標記與投擲線由 Claude 接。
- flight：投出後殺死投擲者仍爆炸，離開半徑不受傷，可傷到其他敵人。讀 grenadeTelegraphs 顯示範圍與倒數。
- resistance：重裝兵原生 1 階，使用兩份資料到 3 階，再用拒絕、不耗道具，可拆解；階數顯示由 Claude 接。
- deep：無盡第 12 層，普通六層局無詞條；legacy：v37 菁英載入成已顯現詞條，資源不變。
- 真機自然遊玩、詞條難度與擲彈標記演出未驗證。REAL_MODE 不在本批。

介面 API、每發規則及驗收結果：[ENEMY_AFFIXES 第 9 節](docs/ENEMY_AFFIXES.md)、[QA 報告](qa/results/2026-09-14-codex-3.75.0-enemy-affixes.md)。
上一批介面待驗內容原文：[3.74 紙條封存](docs/archive/verification-notes-3.74.md)。

