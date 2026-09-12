# 骨架配方（3.66.0）

在本目錄新增 UTF-8 `.json`，執行 `npm run recipes`。`npm start` 與 `npm run build` 也會編譯；不用修改生成器。請一併提交 JSON 與產生的 `src/map-recipes-data.js`。瀏覽器使用同步的靜態 ES module，離線也能生成，不依賴 fetch 或 JSON import attributes。

參考 `workshops.json`、`central-hangar.json`、`dock-row.json`。所有 JSON 檔都會載入，範例不要另存成 `.json` 留在這裡。

| 欄位 | 規則／省略值 |
| --- | --- |
| id | 必填、唯一，英小寫開頭，可接英小寫、數字、連字號，最多 64 字元 |
| name | 可選名稱，最多 80 字元 |
| layout | 必填 3×3，單個 A–Z 字母；同字母屬於同房 |
| theme | industrial（預設）、sanitary、security、utility、platform、dock、balcony；只是素材主題 |
| floors | 含首尾的樓層範圍，預設 [1,999]，以實際樓層而非六層循環判斷 |
| weight | 相對抽選權重，預設 1，範圍 >0 至 100；失敗回退會影響實際比例 |
| openings | 預設 default:[1,2]；large 控制合併房連線，A-B 等標籤覆寫指定相鄰房連線；範圍 1～3 |
| doorRatio | 預設 0.3、範圍 0～1；先定開口數，再分門，每條連線至少一條無門路，故實際比例可低於要求 |
| annex | 預設無；最多兩個房間，例如 {"A":"platform-north"}；type 為 platform/dock/balcony，side 為 north/east/south/west |

房間只能單格、相鄰雙格，或最多一間 2×2。可以有多組雙格。至少五個房間、兩個可作端點的單格房；生成時還必須在三個不同房間保留合格敵人與任務槽位。附屬區必須朝房間外側，不能占入口／出口；明確指定的附屬區全部成功才採用配方。

未支援欄位會報錯，以免拼錯後默默忽略。形狀正確不保證每個種子都能配置：原隔間、走廊、物件與任務仍有安全約束。整份候選失敗改試同池下一份；全失敗或沒有適用樓層時回退完整第五階段。**池完全為空時回到 v1 九宮格相容基準**。

新增主題 ID 需要先在 `src/themes.js` 註冊素材，再加入 `src/map-recipes.js` 的允許清單。生活模組／附屬區局部主題優先於房間主題。配方不能調掉落、敵人 HP、傷害或經濟。

新地圖保存配方副本與生成世代 7。已存樓層不重新生成；日後移除原 JSON 不影響讀取。勿拿不同世代的每日種子直接比較。

驗證：`node --test tests/map-recipes.test.mjs`、`npm test`、`npm run build`。檔案場景：`node qa/create-recipe-scenes.mjs`，只在 `?test=1` 匯入。
