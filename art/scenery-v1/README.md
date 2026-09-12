# 大房間素材 v1

2026-09-12，內建 GPT Image 生成單張連續圖集。完整提示詞在 prompt.txt，原圖 source-atlas.png。沒有使用 API／CLI 付費後備路徑。

## 重建

`python tools/pixelize_scenery.py`（需要 Pillow）。輸出 assets/pixel/scenery-v1/。

- 原圖上方左／右各為完整裝甲車與穿梭艇，先整體縮成 64×96，再按 32×32 切成六塊；不逐塊裁白邊或置中，避免部件接縫散開。
- 這張來源的底列從約 912/1280 高處開始，裁切框明確寫在腳本及 atlas.json；新來源請重新指定裁切，不假設所有模型輸出完全對齊。
- 使用 nearest sampling、alpha 門檻 224、共享 31 色加透明、RGB555、無抖色。保留真實 alpha，不猜背景色。所有 PNG 部件是 indexed palette，palette index 0 透明。
- 底列為 desk／pallet／panel-face／panel-cap。面／頂板用不同素材，隔板依軸向投影成薄頂板＋0.5 地格高面；不把直立面旋轉躺在地上。
- atlas.png 是正式遊戲載入檔；單塊 PNG 供手工替換或後續審稿，preview.png 是 nearest 放大預覽。部件雜湊、原圖雜湊、Pillow 版本及製程存在 atlas.json。

## 遊戲接線與修改邊界

src/scenery.js 對應固定 sprite index、模組相對座標與耐久／full 屬性。車輛目前直朝北，不旋轉圖集；每台 2×3 格，模組連外圍操作空間共 4×5 格。

每格是一筆 cover prop，綁定 moduleId，保留獨立 HP；只有座艙兩格為 full，其他四格一般掩體。完整掩體遮視線／射線／爆風，破壞只清掉自己的遮擋和通行限制，不連鎖刪除兄弟部件。每格仍可按既有入口瞄準／射擊，受傷才顯示耐久。

目前所有部件均可各自破壞；未做不可破壞底盤、整車爆炸、車輛駕駛或分段受損專用造型。壞掉的一格沿用碎片顯示。新增大型主體可沿用模組 parts；不要原地改既有 style 的座標或存檔耐久，需新 ID 或遷移，否則會拒絕舊檔。

這批是試作：手機尺度、完整物件辨識、遮擋及隔板外觀交給使用者／Claude 審。月台／碼頭／陽台的現有不自然外觀是使用者另行思考項，本批未重設計它們。
