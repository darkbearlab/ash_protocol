# 門素材 v1

2026-09-13，使用內建 GPT Image 生成單張 2×2 材質表；完整提示詞見 `prompt.txt`，原圖 `source-atlas.png`。沒有使用 API／CLI 生圖。

`python tools/pixelize_doors.py` 以 nearest 取樣成 64×64，再用共享 24 色 RGB555 色盤量化、不抖色。四片各 32×32；第 0 色只保留作透明索引，材質像素均不使用它。manifest 保留 Pillow 版本與 SHA256，可重建與比對。

輸出 `assets/pixel/doors-v1/`：closed 關門面、cap 頂面、jamb 門框面、damaged 破損材質（預留），以及 atlas／preview。正式繪製只載入 atlas。

`src/barrier-art.js` 負責幾何：門與隔板一致，面高半格、窄頂板；兩個方向分別投影，不把立面旋轉成橫躺圖。開門只畫兩端門框，保留中央空隙；門毀壞沿用地面斷片。L／T／十字接點使用與隔板相同的材質接柱，逐片耐久獨立，毀壞後重算。

圖像接柱不增加碰撞、掩體或 HP。關門綠線／開門兩側綠點仍是戰術標記。`node qa/create-recipe-scenes.mjs` 可產生接角及雙軸開關門驗收場景。
