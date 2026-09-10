# 場景素材與戰鬥痕跡（3.20.0）

3.24.1：置物櫃、門禁櫃檯與值勤桌固定使用正面圖，不再隨板塊旋轉圖片；板塊內位置、占格與掩體規則保留。彈殼改成四組散落排列，每組混合水平、垂直與兩種斜向，霰彈殼略粗；沿用既有 variant／rotation，舊痕跡直接套用，不重抽 RNG 或改存檔。

3.22 已套用 [可讀性色調與手工選材](MATERIALS.md)，原始 PNG 不變；高牆改半格立面＋實心頂板，取消跨格透明。

3.21 補上 [高牆與 8×8 組合材質](WALLS.md)。下方 3.20 未替換的牆已由新版接手，門框、殘骸與其他回退不變。

## 場景圖集

內建 GPT Image 生成一張 4×4 圖集。實際輸出 1254×1254，按四等分座標取樣，沒有假定來源一定 1024。提示 [prompt.txt](../art/terrain-v1/prompt.txt)、原始 [source-atlas.png](../art/terrain-v1/source-atlas.png)、處理後 [preview.png](../art/terrain-v1/preview.png) 留在 art/terrain-v1/。正式成品位於 assets/pixel/terrain-v1/，不覆寫舊人物／武器／屍體圖集。

`python tools/pixelize_terrain.py` 使用 Pillow，重建十六張 32×32 PNG 與 128×128 atlas.png；manifest.json 保存來源 SHA、Pillow 版本、裁切範圍、每圖與圖集 SHA。最近重建逐位元一致。
- 最近鄰縮小，不用模糊、反鋸齒或抖色。來源亦按像素構圖提示生成。
- 四種地板保持不透明，亮度係數 .78／.78／.53／.74，使地面退到人物與物資後方。
- 其他物件保留生成 alpha，224 閾值二值化；四周最外一個邏輯像素清透明，去除格線邊緣雜點。
- 共用 31 個可見色＋透明 index 0；RGB555 通道取整。8-bit indexed PNG 的 PLTE 僅保留 32 個定義色，不是每張另抽色盤，所有像素索引 <32。
- 圖集：金屬／格柵／衛浴／門禁地板；馬桶、洗手台、櫃檯、掃描器、置物櫃、桌；掩體箱、油桶、補給終端、補給箱、門、隔板。
- 半開／損壞門框、空箱、被毀家具、牆、電梯、人物與掉落標籤沿用原有繪圖。箱子種類字樣疊在箱體上，仍保留符號與顏色兩個辨識方式。

## 主題介面

src/themes.js 的 THEMES 以語意 role 查 atlas 區塊，layout 不包含圖片座標。industrial、sanitary、security、utility 目前共用同一圖集，分別選金屬、衛浴、門禁、格柵地板；這是第一組素材管線，不是四套完整獨立世界美術。

themeAt 先看生活模組，再看所在房間的可選 visualTheme，最後 industrial。衛浴／門禁／哨站自動對應 sanitary／security／utility。未知主題退回 industrial，缺 role 亦回到 industrial；若依舊不存在或圖片未載入／錯誤，Renderer 保留原來繪圖。任意存檔字串不能變成外部圖片 URL。

加入下一組：在 assets/pixel/terrain-v2/ 等新目錄交圖集，THEMES 註冊自己的 atlas URL、tile、columns、roles；所需檔案加入 sw.js，更新版本與建置。圖片 URL 為相對 import.meta.url，適用 /ash_protocol/。不要只覆寫舊圖卻不改版本／資源路徑。
- 地板按一格完整繪製；物件中央對齊，門與隔板中央對齊格間邊界。
- 生成門板為垂直，axis:y 繪圖轉 90 度；置物櫃 locker、門禁櫃檯 counter、值勤桌 bench 固定正面；其他家具沿用模組 rotation。模組轉向仍決定家具所在格，不能旋轉整張帶立面的圖來冒充另一個視角。
- 不改格子、移動、耐久、掩體、點選範圍、物品或資源生成；美術主題與敵人來源／關鍵字分開。

## 持久戰鬥痕跡

src/traces.js，Game.traces，每筆 {x,y,kind,variant,rotation}。七種：blood 血、oil 油、casing 小彈殼、shell 霰彈殼、scorch 焦痕、chip 彈著碎屑、debris 破壞碎片。每格至多 3 種，每層至多 192 筆；同格同類更新外觀，達上限淘汰最舊痕跡。雜湊 seed／floor／turn／格子／種類決定樣式，從不呼叫遊戲 RNG。

實際敵我槍擊才留殼：步槍／手槍彈小殼，霰彈不同顏色。能源、榴彈與近戰不假造實彈殼；視覺連發數不增加痕跡數。失去目標但已承諾扣彈的射擊仍留殼，尚未執行就死亡／失能沒有射擊殼。生物受傷留血，mechanical 關鍵字受傷留油（並存時優先油）；玩家共用。物件受傷留碎屑，破壞留下碎片。能源直擊與爆炸留下焦痕，EMP／震撼／煙霧不燒焦。

爆炸痕跡使用破門前的 blast footprint，不漏到原本受遮蔽區；既有爆炸傷害仍走原邏輯。痕跡只在合法地板上，不宣稱新增實體牆壁彈孔。地面層位於危險提示、屍體、掉落、箱／家具、人物與目標標記之下；不占格、不提供掩體，不會遮擋可拾取物。每個 frame 先按格分組，避免對每格掃整層痕跡。

痕跡在規則結算處記錄，presentStep 快照保留前後；射擊痕跡待彈道抵達才出現。不能在 rAF／播放或讀檔時再生成；長按、免費預備或等待不平白生痕跡。只保存當前樓層，下樓清空；本輪沒有跨樓層回程。

## 保存與驗收

save v17 接受 v1–v16，舊存檔補 traces=[]，不追補歷史戰鬥。v16 首次本機讀取保留原件；profile v4／backup v1 不變，完整備份與單局均保留痕跡，非法種類、座標、變體、旋轉、重複或超量資料拒絕載入。

新增 13 項自動測試（10 痕跡＋3 主題／PNG），規則與完整測試結果見 HANDOFF。七份 fixture 由 `node qa/create-3.20-fixtures.mjs` 產生。正式手機縮放可讀性、長局視覺密度與實際離線交外部 QA，不以圖集預覽代替遊戲驗收。來源圖與 PNG 檢查是 Codex 已執行項目。

異界關鍵字與兩類增援僅記錄於 [OTHERWORLD.md](OTHERWORLD.md)，不在本批實作。
