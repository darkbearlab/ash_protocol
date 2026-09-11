# 狂戰士／忍者備用候選（3.48.3）

每張都用 `tools/pixelize_classes.py` 同一套 `indexed()`、同樣的尺寸上限縮成 32×32：狂戰士 29×27、忍者 27×26。所以這些檔案就是換進遊戲後的樣子。

- `round1-sheet.png`：第一輪 A1～C2，含現行版對照。
- `round2-ninja-sheet.png`：第二輪高科技忍者 N1～N3，每個都放在 B1 狂戰士旁邊。

| 檔名 | 內容 | 原圖（只在本機 _gptImageCaller/outputs） |
| --- | --- | --- |
| A1／A2-berserker、-ninja | Codex 提示詞重產：斧斜握腰前、刀雙手斜舉 | ash_melee_A_20260911_221713_01／02 |
| B1-ninja | B1 同張的忍者：壓低身體、反手握刀 | ash_melee_B_20260911_221806_01 |
| B2-berserker、-ninja | 斧扛肩；反手握刀 | ash_melee_B_20260911_221806_02 |
| C1／C2-berserker、-ninja | 斧高舉；刀直立身前 | ash_melee_C_20260911_221844_01／02 |
| N1-1、N1-2-ninja | 高科技忍者，刀低垂身側 | ash_ninja_N1_20260911_222424_01／02 |
| N2-2-ninja | 高科技忍者，刀收左腰（N2-1 已採用） | ash_ninja_N2_20260911_222453_02 |
| N3-1、N3-2-ninja | 高科技忍者，刀背在背上 | ash_ninja_N3_20260911_222525_01／02 |

換成備用的方法：把對應原圖複製進 `art/classes-v1/`，改 `tools/pixelize_classes.py` 的 `MELEE_V3` 路徑與分割欄，重跑腳本，再更新 SHA、報告與版本。
