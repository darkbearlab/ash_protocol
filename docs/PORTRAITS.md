# 隨局頭像（3.13.0）

3.14.0：使用者認可第二輪風格，正式採用 art/portraits-v2 的 16 張 64×64／16 色成品。前四張沿用 ember／onyx／silver／cedar ID，其餘 portrait-05–16；舊檔雜湊仍固定四 ID。重建使用 python tools/pixelize_portrait_atlas.py --install；下方 3.13 第一輪來源保留，舊處理程式現只寫 art/portraits/cells-v1，避免覆蓋新池。

四張原創日系正面頭像由內建 GPT Image 生成，經 Python／Pillow 處理成真正 64×64、最多 32 色的索引 PNG，RGB 各通道限制在 5-bit 色階，不抖色；介面用最近鄰放大。外觀不影響職業、能力、地圖或戰鬥亂數。

- `src/portraits.js`：穩定 ID `ember / onyx / silver / cedar`。追加新圖可擴充池，已發布 ID 不刪改；路徑由白名單取得。
- 每次開新局選角畫面，使用獨立的 `Math.random` 配發頭像，同次 Soldier／Recon 不重複。選定後把該預覽 ID 傳入 `new Game(seed, unlocks, carrying, character, portrait)`，確認前不更動舊局。
- `player.portrait` 隨本局固定，換層、重整、單局匯入及完整備份還原不重抽。背包、繼續任務和結算使用同一 ID。
- 陣亡 `status==='dead'` 才降彩度／亮度並疊 KIA 文字印章；成功與主動放棄不蓋章。演出仍經原有 playback 完成後開結果，不提早宣告死亡。
- 單局 v10；v1–v9 用舊 `runId`（缺少時用 seed）的 FNV 雜湊選固定頭像，不消耗 RNG、不補給／改動角色。v9 首次本機讀檔保存 `ash-save-v9-backup`，QA 前綴仍隔離。新格式未知／缺少頭像拒絕載入。
- profile v4、完整備份 v1 不變；新歷史附可選 portrait ID，舊歷史不要求補圖。現有地圖上的玩家／屍體精靈未替換。

## 素材與重建

來源與完整提示：`art/portraits/*.png`、`art/portraits/PROMPTS.json`。處理：`python tools/pixelize_portraits.py`（相依套件見 `tools/requirements-art.txt`）。

流程：正方形置中取樣 → BOX 縮為 64×64 → median-cut 32 色（稀少冷色眼睛／護甲燈加權）→ RGB555 色盤 → 每格最近色、不抖色 → 8-bit 索引 PNG。8-bit 是檔案索引深度，實際顏色不超過 32。同來源與相同 Pillow 版本可重建相同位元組，版本與 SHA-256 記於 manifest。

- 正式成品 `assets/pixel/portraits/{id}.png`，四張約 9 KB；均列入 SW 離線預快取。
- 4 倍最近鄰預覽 `art/portraits/preview.png`。
- `art/portraits/manifest.json` 保存來源／結果 SHA-256、使用色數、大小及 Pillow 版本。
- 來源、提示、預覽與處理程式保留 Git；build 只部署 assets 成品。

使用者建議後續擴充採一次生成 **4×4 頭像圖集**，再等分切割送同一處理流程，以節省成本。每格需固定正面構圖、同尺寸與邊界，避免跨格及裁切頭髮。本批四張在此建議前已生成，直接沿用，未追加生成整張圖集。

## 外部驗證

`node qa/create-3.13-fixtures.mjs` 產生側身、撤離、KIA、舊 v9 四份隔離任務。引擎已驗證結果觸發；手機 320px 排版、選角預覽一致性、KIA 演出與離線頭像顯示交根目錄驗證紙條，不由本批宣稱真機通過。
