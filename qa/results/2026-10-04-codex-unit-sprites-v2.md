# Unit sprites v2 交件檢查

2026-10-04，Codex 親自執行。main 已由 0534c7d 快轉更新到 **0ad78f6 / 3.222.3**。讀取 Claude 工作樹的 UNIT_SPRITES_BRIEF；該工作樹沒有被修改。

## 交付

第一至第五批全部完成，包含可選的兩款加甲步兵。22 種單位，各有站姿與倒地，共 44 張。

- 成品及色盤、SHA-256、4 倍預覽：`assets/pixel/units-v2/`。
- 透明來源、22 份實際提示詞、可重跑製程：`art/units-v2/`。
- 接入說明：`docs/UNIT_SPRITES_HANDOFF.md`。

全部選用本輪 v1，沒有使用者手修；造型仍待使用者看圖核准。使用者已批准保留既有外框色 `(12,14,18)` 作為唯一 RGB5 例外。沒有製作選配的地上物品；沒有改除名幹員、原角色圖或精英的獨立圖。

## 檢查結果

| 本輪自己執行的檢查 | 結果 |
| --- | --- |
| `python art/units-v2/validate.py` | 44/44：32×32、4-bit indexed PNG、透明索引 0、外框索引 1、最多 16 個實際使用色、二值 alpha、四邊至少 2px 透明、RGB5 / 外框例外、palette 與實際 PNG 一致、來源與成品 SHA-256 |
| 全量再次執行 `process.py`，比對重跑前後全部 sprite 中繼資料 | 完全一致，包括 44 張成品 SHA-256 |
| 正式 `atlas.png`、`aftermath.png`、`classes-v1/atlas.png` 的交件前 SHA-256 | 三份均未改變；完整值見 `art/units-v2/protected-files.json` |
| `npm test` | 1714 tests，1714 pass，0 fail / skipped |
| `node qa/enemy-data-identity.mjs` | identical to baseline：generation 780、missions 125、bots 24；沒有重錄或接受差異 |
| `npm run build` | 通過，8 public entries，支援 `/ash_protocol/` |
| 縮圖目視 | 檢視全部 22 對的 4 倍最近鄰預覽；頭目、蟲、三類機械、軍犬、寵物、感染者與加甲兵的輪廓 / 配色可區分 |

原始紀錄保留於 `art/units-v2/validation/`：`npm-test.log`、`identity.log`、`build.log`、`format-report.json`、`reproducibility.txt`。製程環境 Python 3.12.14 / Pillow 12.3.0 / numpy 2.3.5。

## 範圍與後續驗收

沒有修改 `src/`、遊戲樣式、正式圖集、sw.js、版本、存檔或既有測試期望值。沒有遊戲內接圖，所以沒有做瀏覽器或手機視覺驗收；沒有接觸玩家儲存空間。save-fuzz 不適用這次純素材交付，未執行。沒有提交、推送或發布。

Claude 接入時需特別驗軍犬的派系圖格、pet 的獨立外觀、工程師 sourceId 對應及屍體分流，並以既有圖格像素不變為守門條件。生成圖上的細小附件在 32px 會簡化，優先驗證手機上角色識別與暗房可讀性。完整接入清單在交接文件。
