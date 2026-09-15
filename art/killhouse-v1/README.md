# Kill house 地圖素材

3.87.0，內建 image_gen 生成。單一 4×2 圖集、每種類一張，未修改設施素材。

- 原圖：source.png
- 原生像素圖：../../assets/pixel/killhouse-v1/atlas.png（128×64，8 格，每格 32×32）
- 預覽：preview.png（最近鄰放大 6 倍）
- 重建：`python tools/pixelize-killhouse.py`。等分裁切 → BOX 縮成 32px → 每格最多 16 色且不抖色 → RGB555 → alpha 128 門檻；全不透明材質填實 alpha，破門與掩體保留原圖透明。
- 順序：地板、牆面、牆頂、關門、破門、門框、門頂、掩體。地圖只使用掩體與門，沒有需要額外素材的生活擺設。
- 提示原文如下；不是 CLI/API 生成，沒有 API 金鑰。

```text
Create a production game texture atlas: exactly FOUR columns by TWO rows, eight equal square cells, edge-to-edge no margins no gutters no labels. Each cell must be a simple 32x32-pixel-style tile enlarged with nearest neighbor. Orthographic screen aligned tactical top-down game, NOT isometric. Clean virtual military kill house training simulator, subdued slate blue/gray monochrome surfaces with tiny pale cyan seams. No grime, no blood, no text, no actors, no objects beyond specified tile. Row 1 left to right: (1) flat full-square floor panel, very subtle square grid seam along edges, dark low contrast; (2) full-square FRONT wall face, flat vertical metal panel, subtle bottom shadow; (3) full-square TOP wall cap slab, flat top-down, slightly brighter; (4) full-square CLOSED DOOR front panel, center vertical split, thin cyan border. Row 2 left to right: (5) BROKEN DOOR front texture with central jagged gap and sparse fragments, on transparent background; (6) solid door FRAME/JAMB front-face material panel, no arch, full square strip texture; (7) full-square door TOP slab material, small cyan trim; (8) single cover block seen from above and a little front face at bottom, contained in square, transparent outside block. Coherent genuinely chunky SNES pixel-art shapes, hard pixel boundaries, no smooth gradients, no fine high resolution details. The floor, wall, closed door, frame and top cells must be fully opaque. One atlas PNG.
```
