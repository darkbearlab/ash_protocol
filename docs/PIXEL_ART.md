# 真點陣素材製程

> **美術待辦（3.39.0 記錄）**：工程師的放置哨兵仍沿用懸浮巡弋無人機（`drone`）的精靈，應另做地面砲台外觀。**3.223.0 已完成**：定點砲台改用 `units-v2` 的 `turret`（見文末「3.223.0」）。

3.13.0 新增四張 64×64 日系頭像，最多 32 色，原圖／提示與 RGB555 處理程序見 [PORTRAITS.md](PORTRAITS.md)。後續擴充依使用者建議採 4×4 圖集切割。

此版以內建 **GPT Image** 生成 `art/source-atlas.png`。完整提示保存在 `art/PROMPT.md`，生成結果包含真 alpha。原圖是 1254×1254 圖集；**原圖本身不被當作真低解析度精靈**。

## 重建

```sh
python -m pip install -r tools/requirements-art.txt
python tools/pixelize.py --source art/source-atlas.png --out assets/pixel
```

預設 32×32，每張最多 16 色（包括透明）。例外：煙霧場（`assets/pixel/smoke-field-v1/`，3.202.0）是 256×256 的無縫貼圖，一樣 4-bit、16 色內、RGB5；事先疊好的 `baked-*.png` 透明度有四階，因為煙本來就是半透明的（`art/smoke-field-v1/README.md`）。流程：

1. 依 4×4 均分來源圖集，使用 alpha≥128 裁出各精靈輪廓。
2. 保留長寬比，以 BOX 區域取樣縮成 32×32 画布內的最多 28×28 內容；四周保留透明邊。
3. 以 median-cut 產生最多 15 個不透明顏色。稀少而明亮的青色面罩 / 狀態燈加權，避免被大面積暗色吃掉。
4. 每個 RGB 通道先轉為 0–31 的 5-bit 值，再轉回 PNG 的 0–255 顯示值。
5. 將每個像素直接映射至最後的有限色盤，不使用抖色。Alpha 硬化為透明 / 不透明兩值。
6. 寫成 PNG 色彩類型 3、**位元深度 4** 的索引圖片，palette index 0 為透明。
7. 合成 128×128 atlas、最近鄰 4 倍預覽與含 SHA-256 / 色盤的 atlas.json。

生成來源原圖、低解析度成品、程式和提示均保留在 Git 倉庫，可重做、檢查或換圖。這是以超任圖像規格為靈感的瀏覽器素材，並非可直接燒錄到 SNES VRAM 的 ROM 資料格式。

## 目前接入

角色、槍兵、突擊兵、狙擊手、重裝、無人機、頭目、獵犬、自爆體、箱體、油桶和終端使用 atlas。3.1 已移除戰場旁的人物面板。Canvas 關閉 imageSmoothing，面板設定 image-rendering: pixelated。原有程式美術仍作為圖片尚未載入時的 fallback。

醫療、彈藥、手榴彈也已產出 PNG，保留給後續 UI / 場景擴充；目前部分道具仍用原有簡圖。

## 3.1 屍體與攻擊圖集

內建 GPT Image 編輯模式，以原圖作角色參考；新來源為 art/source-aftermath.png，提示為 art/PROMPT_AFTERMATH.md。包含十個倒地角色外觀与六種特效，gunner 共用 rifleman 的外觀。

此次生成來源為 RGB，**棋盤背景烘焙在圖中，不是真 alpha**。使用顯式 --remove-checker 選項，逐格從邊界 flood-fill 移除近中性灰色背景（通道差 ≤14、最小通道 95–225），保留暗輪廓與封閉盔甲部分。此步驟專供本來源，不會對其他真透明原圖自動套用。再走既有 BOX / median-cut / RGB5 / 硬 alpha 流程。

```sh
python tools/pixelize.py --source art/source-aftermath.png --aftermath --remove-checker
```

產物位於 assets/pixel/：aftermath.png、aftermath.json、aftermath-preview-4x.png、dead-*.png 及六個特效 PNG。遊戲讀取圖集；粒子、彈道與縮放時序由 Canvas 驅動，最多同時保留 64 筆特效。屍體不會阻擋移動或影響掉落。

## 驗證

`npm test` 直接讀取 兩組共 32 張 PNG 的 IHDR、PLTE、tRNS 和 SHA-256，確認 32×32、4-bit 索引、最多 16 色、RGB5 色階与透明索引。不依賴「看起來像像素」的主觀判斷。

限制：目前每個角色只有一個向下的静態姿勢，玩家方向以小標記表示，還沒有四向動畫；地板和牆仍為程式化方格。

## 3.48 八職業灰色精靈

玩家改用獨立 `classes-v1/atlas.png`，各職業站姿與倒地各一張；士兵保留舊輪廓轉灰。32×32、九階中性灰＋透明，適合日後疊色。來源、提示、預覽與重建說明見 [classes-v1 README](../art/classes-v1/README.md)，管線為 `tools/pixelize_classes.py`，座標入口為 `src/class-art.js`。不改敵人、友軍、戰鬥與存檔。

3.48.2 起玩家可在新任務的行動員畫面選塗裝顏色（`src/operator-color.js`；3.140.0 起可用色輪選任意顏色，見 [OPERATOR_COLOR.md](OPERATOR_COLOR.md)）。renderer 把灰階依明暗對應到「陰影 → 顏色 → 高光」後快取成小畫布，站姿與倒地共用；選「原色」就畫原本的灰圖。所以重畫這組圖時要維持中性灰與透明背景，灰階範圍大致落在 16～181，顏色對應才會正確。

3.48.3：狂戰士與忍者的站姿、倒地換成使用者選的新造型（本機 _gptImageCaller 產圖，同一套縮圖流程），提示詞見 `art/classes-v1/PROMPT-melee-v3.md`，備用候選在 `art/classes-v1/candidates/`。

## 3.122.0 原色加外框（Codex 美術，使用者採用）

八職業站姿與倒地、十二組敵人與共用角色的站姿與倒地（共 40 格）在透明處補深色外框（12,14,18），原有像素一律不改；狂戰士站姿另依使用者核准水平放大 125%。三張正式圖集換成 `art/sprites/adopted/original-outline-2026-09-17/` 的採用快照，尺寸、索引、物件格（掩體、油桶、補給、終端）與特效格都不變。

- 重製：`generator.lua`（Aseprite 批次）讀的是 `assets/pixel/` 的正式圖集，**現在正式圖已有外框**，重跑前要先把來源改指向同資料夾的 `source/`（本次修改前的三張正式圖），否則會重複加框。
- 各角色的單張 PNG（`assets/pixel/*.png`、`classes-v1/*.png`）與它們的 json 雜湊沒有跟著換，遊戲只讀圖集；測試仍檢查那些單張檔。
- 交接與逐格核對見 [SPRITE_OUTLINE_HANDOFF.md](SPRITE_OUTLINE_HANDOFF.md) 與 qa/results/2026-09-17-claude-3.122.0-sprite-outline.md。

## 3.223.0 專用單位圖（units-v2，Codex 美術，使用者手修）

原本借用別人圖格的 22 個單位改用自己的圖：頭目 6 個、軍犬、被感染者、幼蟲、巨型蟲、固定砲台、浮游彈藥、自爆機器人、重裝火焰兵、督戰官、小隊長、破門手、被感染槍兵與突擊兵、伴生獵獸、加甲步槍兵與突擊兵。規格見 [UNIT_SPRITES_BRIEF.md](UNIT_SPRITES_BRIEF.md)，交件見 [UNIT_SPRITES_HANDOFF.md](UNIT_SPRITES_HANDOFF.md)。

- 格式和上面相同：32×32、4-bit 索引、最多 16 色含透明、RGB5；外框 `(12,14,18)` 是使用者核准的唯一例外。
- **製程鏈**（都在專案根目錄執行）：
  1. `python art/units-v2/manual/pack.py`：從 Codex 交的 v1（`art/units-v2/codex-v1/`，44 張與 sprites.json）套上使用者的手修圖 `art/units-v2/manual/units-v2-edit-2026-10-04.png`（清理輪廓，44 格改了 41 格），寫出 `assets/pixel/units-v2/`。使用者用的純黑換成外框色，其他顏色照畫的；沒改的 3 格就是 Codex 的檔案。
  2. `python tools/append_units_v2.py`：把 22 個站姿追加到 `atlas.png`、22 個屍體追加到 `aftermath.png`，排在原有 18 格之後（兩張都變成 128×320）。舊格逐像素不變，重跑結果相同。
- v1 本身由 Codex 的 `python art/units-v2/process.py` 從 `art/units-v2/sources/` 確定性產生，只有換來源圖時才需要重跑。它直接寫進 `assets/pixel/units-v2/`、蓋掉手修版，所以重跑之後要把那 44 張與 sprites.json 複製到 `codex-v1/`，再跑上面兩步。
- `art/units-v2/validate.py` 是 Codex 交件時的檢查，其中一項確認正式圖集沒變，接入之後就不成立了。接入後改由 `tests/unit-sprites.test.mjs` 檢查格式、雜湊、圖集順序，以及每個單位對到的圖格。
- 遊戲端：`SPRITE_NAMES`／`AFTERMATH_NAMES` 照同一順序追加（`UNIT_SPRITES_V2`），卡片拿掉借來的 `key` 與染色。軍犬、定點砲台、浮游彈藥、伴生獵獸依單位本身換圖（`enemySprite(type, actor)`，[ENEMY_DATA.md](ENEMY_DATA.md) 4.5）。
