# 蟲群生成點素材（3.71.0）

使用內建 GPT Image 生成一張 4×2 圖集。原始輸出 `source-atlas.png`、完整提示 `prompt.txt`，實際 32px 預覽 `preview.png`。

- 上排地洞、下排紫色裂隙。每排依序：休眠、活躍、塌陷瞬間、永久殘跡。
- `python tools/pixelize_nests.py`：均分裁格 → nearest 縮為 32×32 → alpha 門檻 160 → 全圖共享 31 色 RGB555 調色盤 → 無抖色 indexed PNG。
- 遊戲使用 `assets/pixel/nests-v1/atlas.png`（128×64）；同目錄包含單格圖與來源／成品 SHA256 manifest。預覽放在 art，避免混進遊戲快取。
- `src/nest-art.js` 管理繪製與 280ms 短演出；地洞落土、裂隙方形微粒都不消耗遊戲亂數。`runtime-enemies.js` 的 `NEST_STYLES` 與 `nestStyle` 管理風格名稱／顏色及穩定選擇。
- 保留來源 alpha，成品二值透明；瀏覽器關閉 image smoothing。不是直接把高解析圖縮放當成低解析素材。

未做真手機視覺驗收。使用 `qa/create-nest-scenes.mjs`，兩份最後一次生成場景可快速觀察塌陷與殘跡。
