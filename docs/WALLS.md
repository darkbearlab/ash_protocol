# 半格牆與可組合素材（3.22.0）

## 視覺幾何（3.22 取代舊高牆）

依使用者肉眼回饋，取消 3.21 的兩格高外觀與透明頂面。整片牆回到同一個地格內：南側露出的牆，下半格為立面、上半格為實心頂板；南側仍接牆時只畫完整頂板。單片 32px 牆是 16px 立面＋16px 頂板，縮放等比例。四鄰接、轉角、T 接點只在外緣畫線，牆不突出到可走格。

不再因背後有已探索地板而透明。原有探索霧亮度仍保留，牆格有實心底色。地板先畫、牆其次、物品／家具／門／人物／效果後畫；不改地板座標或點選。四方向、移動、掩體、視線與射線規則不變。

材質按用途套用 [可讀性色調](MATERIALS.md)；房間風格仍穩定，不耗 RNG。地板／立面／頂板現在可用固定 T／W 編號跨類別選用；room.wallStyle 可沿用原英文字名，也可指定編號，最後受手工批准清單約束。

整片牆體仍不可破壞；格間門／隔板沿用原規則與外觀高度，未加牆面彈孔。存檔 v17／profile v4／backup v1 不變，舊局立即套用新版外觀，不需重置。

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
