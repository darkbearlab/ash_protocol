# 高牆與可組合素材（3.21.0）

## 視覺幾何

仍是四方向俯視棋盤，格子、點選、碰撞、掩體、視線與射線沒有移位。每格牆的立面高一個地磚，頂面向畫面上方抬升一個地磚；單獨露出的牆在畫面上共占兩格高（32px 立面＋32px 頂面），縮放時等比例。只有南側暴露的牆畫立面，連續牆的頂面沿四鄰接合，外緣線不跨越共用邊。不是斜向或等角控制。

繪製順序：地板 → 依 y 排序的高牆 → 痕跡／物品／家具／門 → 人物／瞄準與戰鬥效果。頂面投影碰到已探索的可走地板時，該頂面透明度乘 0.12，保留地板可讀性；未知地板不做透明剖面，未探索物件也不因此出現。牆的已探索／當前可見亮度沿用鄰接地板，未新增穿牆視線。畫面下方多取兩格，避免牆腳在螢幕外時頂面被提前裁掉。

整片牆體仍不可破壞；格間門／隔板沿用 3.20 圖和 3.16 規則，未改高。這批不包含牆面彈孔。手機實際遮擋感、連續走廊的高度感仍由外部驗收。

## 素材與重建

內建 GPT Image 生成一張 4×4 正交材質圖集，來源提示 [prompt.txt](../art/walls-v1/prompt.txt)、原圖 [source-atlas.png](../art/walls-v1/source-atlas.png)，處理後 [preview.png](../art/walls-v1/preview.png) 和 [64 組預覽](../art/walls-v1/combinations.png)。正式素材在 assets/pixel/walls-v1/，不覆寫 terrain-v1 或外部頭像。

執行 `python tools/pixelize_walls.py`。依來源實際大小四等分，最近鄰取樣 32×32；立面亮度 .70、頂面 .88，31 可見色＋保留透明槽、共用 32 色 RGB555、無抖色；牆材質所有像素保持不透明。PNG 調色盤寫法共用 pixelize_terrain.py。manifest.json 保留來源 SHA、裁切座標、Pillow 版本、PNG SHA 和管線設定。來源與處理程序都要提交，不只提交 atlas。

- 立面 8 種：armored、reinforced、concrete、ribbed、conduit、vent、hazard、access。
- 頂面 8 種：steel、olive、concrete、grille、cables、grid、hazard、bolted。
- 兩組各自選擇，共 64 種搭配；不是 64 張重複圖，執行時只載入一張 128×128 atlas。

src/walls.js 提供 wallStyle／wallGeometry／drawWall，src/renderer.js 接入。主題沿用 themeAt 的房間／模組解析；同房間預設共用頂面，少數格換設備立面。素材選擇只用種子、樓層、房間座標與整數雜湊，不耗遊戲 RNG，不在 rAF 重抽。

美術配置可在房間加 `wallStyle: {face:'access', cap:'bolted'}`，兩欄獨立可選，未知名稱回預設；不接受任意圖片 URL。這是可選外觀資料，不自動改寫舊存檔。save v17／profile v4／backup v1 維持，舊局立即使用新版繪圖，原幾何與資源保留。

## 驗證交接

五項新增自動測試涵蓋 16 種鄰接、縮放接縫、64 搭配、已探索淡化、缺圖回退、全畫面繪製順序、四方向點選、存檔／RNG 不變與 PNG 色盤／SHA。全套 267 項測試與 build 通過。未自行跑瀏覽器或手機 QA。

`node qa/create-3.21-fixtures.mjs` 產生四份有效存檔：wall-gallery、wall-alternate、natural-321、natural-790。前兩份為 HP 999 的人工外觀場景，不能拿來判定難度。驗收項目見根目錄給驗證者的紙條。
