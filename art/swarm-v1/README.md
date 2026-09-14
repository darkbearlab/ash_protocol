# 毒液噴吐蟲素材（3.84.0）

使用內建 image_gen 生成，沒有使用 API／CLI fallback。source.png 保留原始透明圖；`python tools/pixelize_swarm.py` 沿用 pixelize.py 的32px、16色含透明、5-bit RGB、無抖色製程。assets/pixel/swarm-v1/ 保存索引站姿、倒地、預覽與色盤／來源雜湊。

追加位置：atlas.png／aftermath.png 第18格，x32 y128。前17格逐像素與 b4f9c91 相同，執行 `python qa/swarm-art-check.py` 可重驗。沒有重排或重新量化舊素材。

## 實際生成 prompt

Create a single game sprite sheet containing exactly TWO sprites side by side in two equal cells, genuine transparent background. LEFT: living alien venom-spitter bug standing, RIGHT: the same bug collapsed dead on its side. SNES era authentic very low resolution pixel art, designed as 32x32 pixel sprites enlarged with nearest neighbor: large chunky pixel clusters, simple silhouette, no small high-resolution details, no antialiasing, no gradients. Top-down three-quarter camera like a tactical shooter. Muted olive/chitin brown insect, four short angular legs and two small front feelers, prominent round yellow-green venom sac on back and a short wide tubular mouth pointing down toward viewer. Not a humanoid, no weapons. Corpse recognizable matching shell and flattened green sac, modest dark green residue. Strong black/dark outline, 12-15 flat colors maximum. No text, no grid, no shadow rectangle, no scenery, ample transparent margin separating sprites. Keep both subjects entirely inside their half. Match gritty pixel military roguelike sprites, prioritize recognizability at true 32 pixels.
