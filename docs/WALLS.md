# 固定 1.5 格牆磚與可組合素材（3.22.1）

## 視覺幾何（3.22.1，使用者明確定義）

**每塊牆磚都是下方 0.5 格立面＋上方 1 格實心頂板，總高 1.5 格，沒有依相鄰牆改比例的例外。** 地磚 32px 時，每塊立面 16px、頂板 32px，總高 48px。這取代 3.22 的「同格半立面＋半頂板」和「相連牆只畫頂板」。

牆腳固定在原牆格底緣；立面往上 0.5 格，再接 1 格頂板，因此頂端比原牆格上緣高 0.5 格。每塊都繪製完整立面和頂板，不再以南鄰是否有牆跳過立面。相鄰磚仍按北到南繪製，前方實心磚可自然遮住後方磚的部分圖像；這是前後遮擋，並非改變後方磚尺寸。四鄰只決定外緣線，不能改高度。

沒有探索地板觸發的透明剖面。探索霧亮度沿用；地板先畫、牆其次、物品／家具／門／人物／效果後畫。高牆只改畫面投影，四方向點選、移動、掩體、視線與射線仍使用原地板座標。

3.22 已獲使用者肯定的 [可讀性色調](MATERIALS.md) 保留，原始 PNG 與人工選材設定不動。素材審核頁共用同一繪圖，同步呈現 0.5＋1 比例。格間門／隔板沿用原高度與規則。save v17／profile v4／backup v1 不變，舊局可繼續。

## 素材與重建

內建 GPT Image 生成一張 4×4 正交材質圖集，來源提示 [prompt.txt](../art/walls-v1/prompt.txt)、原圖 [source-atlas.png](../art/walls-v1/source-atlas.png)，處理後 [preview.png](../art/walls-v1/preview.png) 和 [64 組預覽](../art/walls-v1/combinations.png)。正式素材在 assets/pixel/walls-v1/，不覆寫 terrain-v1 或外部頭像。

執行 `python tools/pixelize_walls.py`。依來源實際大小四等分，最近鄰取樣 32×32；立面亮度 .70、頂面 .88，31 可見色＋保留透明槽、共用 32 色 RGB555、無抖色；牆材質所有像素保持不透明。PNG 調色盤寫法共用 pixelize_terrain.py。manifest.json 保留來源 SHA、裁切座標、Pillow 版本、PNG SHA 和管線設定。來源與處理程序都要提交，不只提交 atlas。

- 立面 8 種：armored、reinforced、concrete、ribbed、conduit、vent、hazard、access。
- 頂面 8 種：steel、olive、concrete、grille、cables、grid、hazard、bolted。
- 兩組各自選擇，共 64 種搭配；不是 64 張重複圖，執行時只載入一張 128×128 atlas。

src/walls.js 提供 wallStyle／wallGeometry／drawWall，src/renderer.js 接入。主題沿用 themeAt 的房間／模組解析；同房間預設共用頂面，少數格換設備立面。素材選擇只用種子、樓層、房間座標與整數雜湊，不耗遊戲 RNG，不在 rAF 重抽。

美術配置可在房間加 `wallStyle: {face:'access', cap:'bolted'}`，兩欄獨立可選，未知名稱回預設；不接受任意圖片 URL。這是可選外觀資料，不自動改寫舊存檔。save v17／profile v4／backup v1 維持，舊局立即使用新版繪圖，原幾何與資源保留。

## 驗證交接

五項牆測試已更新，涵蓋 16 種鄰接、縮放接縫、64 搭配、實心頂板、缺圖回退、全畫面繪製順序、四方向點選、存檔／RNG 不變與 PNG 色盤／SHA。本批全套 273 項測試與 build 通過。未自行跑瀏覽器或手機 QA。

`node qa/create-3.21-fixtures.mjs` 產生四份有效存檔：wall-gallery、wall-alternate、natural-321、natural-790。前兩份為 HP 999 的人工外觀場景，不能拿來判定難度。驗收項目見根目錄給驗證者的紙條。
