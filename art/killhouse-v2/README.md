# Kill house 元件圖集

來源：GPT Image，2026-09-15。`source.png` 保留原圖；`preview.png` 是實際 32px 圖格的最近鄰放大。

重建：`python tools/pixelize-killhouse-props.py`。4×7 等分；材料與車體分件裁至 alpha 邊界；BOX 縮至 32px、每格 16 色、RGB555、alpha 二值化。每類只有一格。既有 killhouse-v1 與設施素材不覆寫。

## 原始提示
Production sprite atlas for clean virtual military kill house, 4 columns x 7 rows, 28 equal square cells, no gutters, margins, labels or text. True chunky 32x32 SNES pixel design enlarged, no antialiasing, no realism or tiny details. Orthographic top-down with a little front face at bottom, not isometric. Slate blue-gray monochrome, restrained pale cyan seams. Clean simulation objects, no grime. First 4 cells opaque square MATERIAL swatches: partition front face, partition top cap, low railing front face, low railing top cap. Next 12 cells individual objects centered and wholly contained on TRANSPARENT backgrounds: row2 crate, barrel, computer terminal, toilet; row3 sink, security counter desk, scanning machine, locker; row4 guard desk, office desk, cargo pallet, flat grate floor (this last cell opaque). LAST THREE ROWS are modular 2x3 vehicles with no outside shadow: left two columns a futuristic rover split into 6 square parts (top row nose pair, middle cockpit pair, bottom rear pair), right two columns a small shuttle split into same six parts (nose, cockpit wings, rear engines). Each cell's corresponding neighboring vehicle parts must touch perfectly. No humans, weapons, characters, lettering. Strong readable silhouettes, simple large pixel clusters and flat shaded planes. Exactly one of each, no variants.
