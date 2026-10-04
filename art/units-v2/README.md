# Unit sprites v2 — 2026-10-04

以 main `0ad78f6` / 遊戲 **3.222.3** 為交件基準。依 Claude 工作樹的 `docs/UNIT_SPRITES_BRIEF.md` 製作，原文快照在 `BRIEF-snapshot.md`。本包不修改遊戲程式或正式圖集。

## 交付範圍

五批共 **22 個單位、44 張單格圖**，包括最低優先的 `rifleman_armored`、`raider_armored`。站姿與倒地各一張。單位清單、設計描述、批次見 `units.json`。地上物品不在此包。

- `sources/<id>.png`：內建圖像生成工具的原始透明來源，一張兩格、左站姿右倒地；保留原始尺寸。
- `PROMPT.md`：每次實際送出的完整提示詞。
- `generation.json`：同一份提示詞與生成工具原始檔位置，供追溯；重跑不需要該絕對路徑。
- `process.py`：確定性的像素、色盤、外框與預覽製程。
- `validate.py`：驗證完整 44 張、來源與成品雜湊、PNG 規格、交件前正式圖集未變。
- `validation/`：Codex 本輪親自執行的檢查紀錄。
- `../../assets/pixel/units-v2/`：成品、色盤與 SHA-256、4 倍預覽。

## 採用狀態

每個單位目前只有一份生成來源，交付選用 **v1**。這是 Codex 選用供檢視的版本，**使用者尚未逐張核准**，也沒有使用者親手修改的像素。使用者已明確批准唯一格式例外：外框保留既有 `(12,14,18)`，其餘顏色遵守 RGB5。未採用的新候選可放 `candidates/`，不要直接覆蓋此批來源。

## 可重跑製程

Python 需 Pillow 與 numpy；實際驗證版本記在 `validation/format-report.json`。在專案根目錄執行：

```text
python art/units-v2/process.py
python art/units-v2/validate.py
```

只處理指定單位：

```text
python art/units-v2/process.py dog pet
```

不需要重新呼叫圖像生成服務；固定來源與相同套件版本可重製位元相同的成品。兩格來源先從中線分開，依 alpha 裁切；BOX 取樣到最長邊 26 像素、置中到 32×32。這沿用現有 `tools/pixelize.py` 的縮圖／減色／RGB5 思路，另外處理新外框及小面積識別色：

1. alpha 在 128 分界，成品只保留 0 / 255。
2. 14 個內部色的 median-cut；高彩度識別色增加色盤取樣權重，避免燃料罐、感染組織與目鏡完全消失。
3. 色值轉到 RGB5 階，最近色匹配，不抖色。
4. 去掉來源外緣中與亮色相鄰的一層過暗像素，避免加框後形成厚黑帶；不挖內部陰影，也保留細長深色槍管。
5. 以四方向相鄰的透明像素補一圈 `(12,14,18)`；透明索引 0、外框索引 1。
6. 索引 PNG，IHDR 為 bit depth 4 / color type 3；最多 16 色含透明。含框輪廓最多 28×28，四邊至少 2px 透明。
7. 預覽只以 nearest-neighbor 放大四倍。預覽含文字與背景，**不是遊戲素材**。

`sprites.json` 的 palette **包含透明色**，與舊 swarm-v1 的色盤列表慣例略有不同，已以 `paletteIncludesTransparency: true` 明示。每張獨立色盤；拼圖集時要轉 RGBA 貼入，不能把不同圖片的索引直接拼接。未配置正式圖集的 x/y，因此目前不列 x/y。

## 檢查與邊界

44 張成品重跑後雜湊及中繼資料完全一致。已檢查透明、尺寸、邊界、位元深度、實際使用色數、RGB5 例外、來源雜湊；三份正式圖集仍符合 `protected-files.json` 的交件前雜湊。Claude 真正追加圖格後，正式圖集雜湊自然會變，該保護檢查只適用接圖前。

沒有修改 live atlas、sw.js、版本或存檔；沒有提交、推送。接圖步驟見 `docs/UNIT_SPRITES_HANDOFF.md`。

## 接入（3.223.0，Claude）

- 使用者手修了輪廓（44 格改 41 格），見 [manual/README.md](manual/README.md)。遊戲用的是手修版，不是這裡 `process.py` 直接產出的 v1；v1 原樣保存在 `codex-v1/`。
- 重做：`python art/units-v2/manual/pack.py`，再 `python tools/append_units_v2.py`（[docs/PIXEL_ART.md](../../docs/PIXEL_ART.md)「3.223.0」）。單獨重跑 `process.py` 會把成品蓋回 v1。
- `validate.py` 確認「正式圖集未變」的那一項，在接入後不再成立。接入後的檢查是 `tests/unit-sprites.test.mjs`。
