# 素材選用與可讀性（3.22.0）

Claude 的 [3.21 可讀性報告](../qa/results/2026-09-10-claude-map-readability.md) 已逐位元歸檔；其瀏覽器實驗沒有改動程式。使用者大致同意 F 組方向，並明確要求縮短牆與實心頂板。本批沒有生成或改寫原始 PNG。

## 色調

src/art-tone.js 的 ART_TONES 按**目前用途**處理：

| 用途 | 對比 | 亮度 | 彩度 |
| --- | ---: | ---: | ---: |
| 地板 | .72 | .95 | 1 |
| 物件 | 1 | .80 | .90 |
| 牆立面／頂板 | 1 | .72 | .60 |
| 活體單位 | 1 | 1.30 | 1.50 |

地板先將每張原素材的平均 luma 調到 52.4，再套上表，避免衛浴原本 73.8 的亮度突跳。灰色樣本從不同明度都會落在約 70；實際有色素材受通道裁切可能略有差異，不宣稱所有像素一致。單位另加 rgba(0,0,0,.9)／8px 暗光暈；屍體維持原低彩度處理。

原圖不變。ArtToneCache 首次使用時在 32px Canvas 內讀取／轉色，再依來源 Image、裁切格、用途快取。逐幀只畫快取圖，不逐幀 getImageData 或依賴 ctx.filter。nearest-neighbor 與 alpha 保留；用途轉色不是再生一張來源圖，也不改原始 32 色 PNG 色盤。

生成素材成功載入時套用色調；缺圖時沿用程式繪圖回退。人物的 HUD／血條／準星、屍體和地面痕跡各自維持原規則，沒有一起增亮。

## 選用管線

- 收件檔：art/materials/selection.json。version:1，三個非空、不重複的 ID 陣列 floor／face／cap。
- 編號：T01–T04 對應 terrain-v1 index 0–3；W01–W16 對應 walls-v1 index 0–15。原檔不需要移動，三類可互換且可重複用於不同用途。
- src/materials.js 的白名單只含上述 20 個不透明方形材質，不允許任意 URL／路徑／家具圖。resolveSprite('floor') 與 drawWall 都經同一清單，停用可覆蓋舊 room.wallStyle 偏好。
- 原偏好仍在該用途清單就保留；被停用時採該清單第一張。因此「准許」不等於「每局必定出現」。房間可用 wallStyle.face/cap 指定固定 ID 或沿用舊英文字名；最後仍受批准清單約束。
- `npm run materials` 檢查並產生 src/material-selection.js；`npm run build` 也會先編譯，然後帶入模組共同雜湊。設定檔與生成模組一起提交。錯誤設定會阻止建置，不默默換回其他圖。
- material-review.html 是獨立審核頁。瀏覽器只編輯記憶體草稿，提供匯入／下載 JSON；不碰 localStorage、正式／QA 任務、後端或 Git。刷新前要下載。下載設定仍須交付並發布才會影響正式遊戲。
- 預覽使用同一 tone cache／drawWall，草稿清單直接傳入繪圖；因此 W03 當地板、T01 當頂板可立即查看。遊戲載入兩張 atlas，跨類別不增加圖片請求。
- 本機 server 補上審核頁及 terrain-v1／walls-v1／portraits 路徑；仍限制公開副檔名與目錄，不開放任意 art／docs／工作區檔案。

## 驗證

更新牆的幾何測試（半格立面＋實心頂板留在同一格）；另六項測試涵蓋色調／alpha／快取、地板明度、設定驗證、跨圖集換用途與獨立審核頁。全部 273 項與 build 通過。瀏覽器頁面操作、手機明度與暗光暈成本留給 Claude／使用者驗證，不用規則測試代替視覺評價。
