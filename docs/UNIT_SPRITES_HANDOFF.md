# 專用單位精靈圖交接 — units-v2

> **3.223.0 已接入**（Claude，2026-10-04）：使用者手修輪廓後接入（44 格改 41 格，`art/units-v2/manual/`）。圖集追加、卡片換圖、軍犬依派系、工程師友軍依機體、伴生獵獸依種類，見 [PIXEL_ART.md](PIXEL_ART.md)「3.223.0」與 qa/results/2026-10-04-claude-3.223.0-unit-sprites.md。

2026-10-04，Codex。基準 main **0ad78f6 / 3.222.3**。依 `UNIT_SPRITES_BRIEF.md` 完成第一到第五批，含兩個可選加甲兵種，共 **22 個單位 / 44 張**。只交素材與製程，正式接入、升版、推送由 Claude 負責。

## 檔案與選用

- 成品：`assets/pixel/units-v2/<id>.png`、`dead-<id>.png`。
- 全覽：`assets/pixel/units-v2/preview-4x.png`；另有 `batch-1` 到 `batch-5-preview-4x.png` 及每單位的雙格預覽。
- 色盤 / 雜湊：同目錄 `sprites.json`。
- 透明來源與確定性製程：`art/units-v2/`；實際提示詞 `PROMPT.md`，重跑見 `README.md`。
- 交付採用 v1；無使用者手修，尚待使用者逐張審美確認。唯一明確核准：外框 `(12,14,18)` 保留，作為 RGB5 唯一例外。

## 交付清單與追加順序

建議按下表序號追加，兩張正式圖集都使用同一單位順序；既有格位不動。表中的屍體檔都為 `dead-<id>.png`。

| 序 | 批次 | id | 主要識別 |
| --- | --- | --- | --- |
| 1 | 1 | designator | 淡灰綠軍官、標定器步槍 |
| 2 | 1 | gunline | 金褐重裝軍官、機槍及折疊腳架 |
| 3 | 1 | arsonist | 橘色防火服、雙燃料罐 |
| 4 | 1 | burnline | 深紅重裝、重型噴火器 |
| 5 | 1 | hive_beast | 寬大頭甲、低重心硬殼 |
| 6 | 1 | hive_matriarch | 紫褐腹部、淺色卵囊 |
| 7 | 2 | dog | 棕色軍犬、戰術背心 |
| 8 | 2 | fodder | 無武器的感染人形 |
| 9 | 2 | brood | 細長分節幼蟲 |
| 10 | 2 | giant_bug | 肉色軟殼、寬大身體 |
| 11 | 3 | turret | 落地三腳砲台 |
| 12 | 3 | munition | 雙風扇懸浮炸彈、紅色彈體 |
| 13 | 3 | bomber_bot | 橘色背炸彈、雙輪底盤 |
| 14 | 4 | heavy_flamer | 灰橘重甲、背罐 |
| 15 | 4 | enforcer | 深色長外套、軍帽、長槍 |
| 16 | 4 | squad_leader | 無線電天線、單目鏡 |
| 17 | 4 | gunner | 厚背心、淺色破門炸藥 |
| 18 | 4 | rifleman_infected | 橄欖軍裝、淺綠增生組織 |
| 19 | 4 | raider_infected | 土褐兜帽、赭紅感染組織 |
| 20 | 5 | pet | 淺灰貓科輪廓、寬前爪、青色挽具 |
| 21 | 4 可選 | rifleman_armored | 步槍兵、淺灰附加護甲板 |
| 22 | 4 可選 | raider_armored | 突擊兵、淺灰附加護甲板 |

## 格式與已知取捨

全部 32×32、4-bit 索引 PNG、最多 16 色含透明，透明索引 0；外框索引 1，值為 `[12,14,18]`。其餘 RGB 通道落在 RGB5；不抖色，alpha 只有全透明與不透明；含外框不超出 28×28。

每張使用自己的色盤，`sprites.json.palette` 包含透明項，`paletteIncludesTransparency:true`。合圖請先解碼成 RGBA 再貼，避免同索引不同色；不要把整張正式圖集再壓回單一 16 色色盤。每個 PNG 的 SHA-256、來源 SHA、裁切資訊已列出。

32px 下小型標定器、腳架與無線電會縮成幾個像素；主要依大輪廓、服裝與裝備色塊辨識。屍體是獨立倒地構圖，並非旋轉站姿。大型單位保持 32px，放大仍交給現有 size；不要再把大圖當素材載入。未烘入雷射、火焰、鉤舌、金色精英框或派系標記。

## Claude 接入注意事項

1. 讀取目前正式圖集、索引順序與格位寬度，把這 22 對圖格**追加**到尾端。不可重排既有的 18 個 atlas 格位（含道具）或 18 個 aftermath 格位（含特效）。本包尚未分配 x/y。
2. `src/enemy-visuals.js` 的 `SPRITE_NAMES` / `AFTERMATH_NAMES` 追加對應名稱；`src/enemy-data.js` 的相關卡改 `sprite.key`、`sprite.corpse`。corpse 名稱使用不帶 `dead-` 的 id，繪製時現有程式會補前綴。保留現有 size / scale 與遊戲規則。
3. 清除這些單位原本為替代圖設的染色，包括可能優先覆蓋卡片 tint 的派系 tint。一般光暗處理、友軍青框、精英框和模擬色調仍由現有演出處理。
4. **軍犬需按派系取圖**：忠誠方、叛軍的犬用 dog；蟲族獵殺蟲仍用原 crawler。不要全域把 crawler 卡改成 dog，會影響蟲與其他共用者。目前 `enemySprite(type)` 不接 actor / faction，接入時要連站姿與屍體都帶到派系資訊。
5. **工程師友軍按 sourceId 取圖**：`drone_sentry → turret`、`drone_munition → munition`、`unit_bomber → bomber_bot`；追隨機體 / 改造無人機仍用原 drone，改造封鎖官 / 核心守衛沿用各自原圖。勿變更 `UNIT_SOURCES` 等規則側的 type 對應來達成換圖。
6. **伴生獵獸按 kind 取圖**：`kind==='pet' → pet / dead-pet`；不要改它在規則中的 crawler 基底。友軍死體繪製需把 actor 身分傳到外觀查詢，避免又退回 dead-crawler / dead-drone。
7. 兩個既有明名精英仍沿用其基底造型加金框；本包沒有獨立精英圖。除名幹員、死靈復生者、既有研究員與毒液噴吐蟲不另重畫。gunner 換圖後，gunner_elite 是否同步指到新 gunner 請按現有「沿用基底圖」規則處理。
8. runtime 路徑保持相對，更新 `sw.js` 與正式圖集的快取版本；不用把原始生成圖、提示詞或 QA 預覽納入離線預載。
9. 加入接圖檢查：新舊格位位置、舊格像素不變、22 個站姿及死體映射、三種友軍機體、pet、各派系軍犬與蟲、精英框、暗房壓暗、手機尺寸輪廓。這輪未接入，因此未聲稱通過遊戲內視覺驗收。

## Codex 親自執行的檢查

- 圖片驗證：44/44，規格、palette、透明、外框、邊界與來源 / 成品雜湊。
- 完整重跑像素製程：44 張與中繼資料完全一致。
- 三份既有圖集雜湊不變：主 atlas、aftermath、classes-v1/atlas。
- `npm test`：**1714 / 1714** 通過。
- `node qa/enemy-data-identity.mjs`：**780 generation、125 missions、24 bots** 全與基準一致，未重錄。
- `npm run build`：通過。
- 未動存檔、預告或回合，因此未跑 save-fuzz；無瀏覽器存檔操作、未清空玩家資料。

完整紀錄：`qa/results/2026-10-04-codex-unit-sprites-v2.md`。無遊戲程式變更、無升版、無提交、無推送。
