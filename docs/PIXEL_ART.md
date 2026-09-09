# 真點陣素材製程

3.13.0 新增四張 64×64 日系頭像，最多 32 色，原圖／提示與 RGB555 處理程序見 [PORTRAITS.md](PORTRAITS.md)。後續擴充依使用者建議採 4×4 圖集切割。

此版以內建 **GPT Image** 生成 `art/source-atlas.png`。完整提示保存在 `art/PROMPT.md`，生成結果包含真 alpha。原圖是 1254×1254 圖集；**原圖本身不被當作真低解析度精靈**。

## 重建

```sh
python -m pip install -r tools/requirements-art.txt
python tools/pixelize.py --source art/source-atlas.png --out assets/pixel
```

預設 32×32，每張最多 16 色（包括透明）。流程：

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
