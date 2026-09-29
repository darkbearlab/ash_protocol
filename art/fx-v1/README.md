# FX v1 製作來源

2026-09-29，依 `docs/FX_SPRITES_BRIEF.md` 製作。基準 main `cbaf1de`，遊戲 3.201.0。本批未接入遊戲。

## 重製

從專案根目錄執行：

```sh
python -m pip install Pillow==12.3.0 numpy==2.3.5
python art/fx-v1/process.py
```

腳本只寫入 `assets/pixel/fx-v1/`，結尾自動驗證五張正式 PNG。重跑會覆寫本批成品與預覽，若手工改過，請先另外保存。Python 3；本次使用 Pillow 12.3.0、numpy 2.3.5。

## 來源與處理

- `PROMPT.md`：四次內建 GPT Image 生成的完整提示詞。
- `source-fire.png`、`source-smoke.png`、`source-vent.png`、`source-flame-burst.png`：原始透明 PNG，不直接當作低解析度素材使用。
- `source-loot-reference.png`：本次開始時正式 `assets/pixel/loot-icons-v1/atlas.png` 的快照，避免未來改圖影響重製；未改動正式檔。
- `process.py`：固定切格、BOX 取樣、人工指定共享 RGB5 色盤、最近色映射、不抖色、透明索引 0、4-bit PNG；沒有隨機數。

火與煙採每列第一張來源形狀，依四個等距相位做 ±1 像素的最近鄰變形，保持循環接點，不直接輪播差異較大的生成稿。火的三列保留不同高度且腳底對齊；來源列間距不均，切割範圍已固定於程式。煙各類只使用三階顏色，同張共 15 個不透明色。

格柵採同一個來源格，所有狀態金屬底形完全一致，人工指定燈號與出氣口像素；不包含煙。火舌保留來源四格的單次演進，共用縮放倍率，朝右。

掉落圖沿用既有通用手槍與角框輪廓，依亮度重著橘紅。正式規格同時要求半透明光暈與二值 alpha；本版以共同格式優先，將弱光暈亮度烘焙成暗色不透明像素，極弱像素移除。燃料主色尚待遊戲端資料決定，本圖為固定橘紅，不更動 `ammunition.js`。

`fx-v1.json` 保存全部來源 SHA-256、正式圖尺寸、色盤與 SHA-256。PNG 是正式素材；`*-preview-4x.png`、`overview.png` 與 `loops-preview.gif` 僅供檢視，不應納入遊戲載入清單。
