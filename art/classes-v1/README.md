# 八職業灰色精靈 v1

內建 GPT Image 生成；原始圖是 `source-atlas.png`，完整提示見 `PROMPT.md`。
站姿／死亡各八張，士兵實際成品沿用 `assets/pixel/player.png` 和 `dead-player.png` 的輪廓轉灰；生成來源的士兵格只作風格比對。

成品：`assets/pixel/classes-v1/`，`atlas.png` 為遊戲載入圖集，`atlas.json` 記錄座標與 SHA-256。`preview.png` 是最近鄰四倍預覽，上排站姿、下排倒地。

重建：`python tools/pixelize_classes.py`（Pillow）。流程：手工指定來源格界避免切到腳部；只從邊界 flood-fill 移除中性亮色棋盤背景（RGB 差 ≤18、最小通道 ≥190）；保留封閉的盔甲高光；BOX 縮放、alpha 128 二值化、映射九階中性灰，輸出 32×32、4-bit 索引 PNG（含透明共十色，無抖色）。所有灰階值來自 RGB555。

一般單位最大 27×26、重裝兵 30×28、狂戰士 29×27；死亡圖同樣保留寬度差，士兵保持既有32格座標。並非直接把高解析原圖當像素圖使用。

未來疊色：成品 RGB 完全相等，適合先以 multiply 色調映射，再用原 alpha 遮罩（不要整格加色塊）。深色輪廓與亮度層次要保留。這輪預設直接呈現灰色，沒有新增角色染色設定或存檔欄位。

renderer 的 `classSprite` 依 presentation 中的 player.character 選圖；迷彩、倒下時序與牆遮擋維持。敵人與友軍的既有圖集不變。尚未做人眼手機戰場驗收，請特別看忍者在暗房的辨識度、重裝兵遮擋感、各死亡姿態。
