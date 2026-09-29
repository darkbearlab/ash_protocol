# 煙霧場（smoke field v1）

2026-09-29，Claude。遊戲版本 3.202.0。規則與畫法見 [docs/HAZARDS.md](../../docs/HAZARDS.md) 第 5 節。

## 為什麼不是逐格精靈圖

Codex 的 fx-v1 `smoke.png` 每格畫成一團獨立的煙，拼成一片時看得出一顆一顆（使用者：「更適合做為一個主體使用，而不是多個 tile 組合」）。這一批改成每種煙一張沒有重複花紋、四邊無縫接回的大貼圖。遊戲讓每一格顯示貼圖裡該位置的那一塊，只羽化雲的外緣（使用者：羽化最多 1/5 到 1/4 格，階梯式）。

## 探索過程（沒有採用的）

用 gpt-image 產了幾組比較，都是遊戲內同一場景截圖給使用者看：

- 逐格圖 A～G：連片霧、大團、煙絲、網點，以及「一大片煙切成方格」的三種。能連成一片的外緣還是方的，也看得出重複。
- 橫條貼圖（五種煙一張）：直向太快重複。
- 正方貼圖的兩種畫風：H（色塊）、I（色塊加網點）。使用者選 H。

## 檔案

- `source-<kind>.png`：gpt-image 原圖（1024×1024，透明背景），提示詞在 [PROMPT.md](PROMPT.md)。
- `process.py`：固定步驟，沒有亂數。重跑輸出位元組完全相同（`manifest.json` 記 SHA-256，`npm test` 會比對）。
  - `layers.png`：BOX 縮到 256px，錯半張混合做成四邊無縫，套 fx-v1 的煙霧色盤（每種三階、RGB5），硬邊透明。五種並排成 1280×256，4-bit。執行時疊三層。
  - `baked-<kind>.png`：把執行時的三層（位置、透明度、壓暗／提亮、底紗）先疊好，再以固定的中位切割減到 15 色加透明、RGB5，透明度只有四階。一種一張 256×256，每張都在 16 色內。這是設定裡的「省效能」。
- `preview-textures.png`：上排 layers，下排 baked，只供檢視，不進遊戲。

## 重製

```sh
python -m pip install Pillow==12.3.0 numpy==2.3.5
python art/smoke-field-v1/process.py
```

`process.py` 裡的疊法數字（`LAYERS`、`VEIL`、`TONES`）要和 `src/renderer.js` 的 `FIELD_STACKS`、`CLOUD_TONES` 一致；`tests/smoke-field.test.mjs` 會檢查位置與透明度。改了遊戲裡的疊法，要重跑這支程式。
