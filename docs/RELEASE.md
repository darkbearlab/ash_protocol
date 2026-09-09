# 發布與 GitHub Pages

使用者的持續要求：每次完成工作都推至 `https://github.com/darkbearlab/ash_protocol`，並整合到 **main**。不要只留下分支或本機修改；不要 force push main。

遊戲網址：`https://darkbearlab.github.io/ash_protocol/`。

## 每次交付

2026-09-09 使用者要求降低操作成本：瀏覽器／手機驗證交給使用者或其他 AI，見 [驗證紙條](../給驗證者的紙條.md)；開發端執行必要規則測試、build、main 推送與部署狀態確認。純文件交接不重跑遊戲測試。3.2.0 已獲授權開發；勿將尚未執行的外部 QA 標為通過。

1. 將 UI 驗證情境交接給使用者／其他 AI，指定 `?test=1` 隔離頁面並列出未測項目。
2. `npm test`、`npm run build` 必須成功。
3. 更新 HANDOFF、DESIGN 和 CHANGELOG。
4. `git status` 確認沒有秘密、暫存檔或未預期檔案。
5. commit 後推至 origin/main；若用了分支，先正常合併到 main，禁止覆蓋遠端歷史。
6. 確認 `.github/workflows/pages.yml` 成功；線上 BUILD 與素材載入由接手驗證者確認。

## 自動部署

每次 push main，GitHub Actions 執行 Node 22 測試與建置，將 **dist/** 作為 Pages artifact 發布。原始美術 `art/`、文件、測試、Git 資料與輔助工具不在網站產物中。

Pages 設定使用 **GitHub Actions** 作為來源。完成一次設定後，後續 main push 自動部署。首次尚未啟用時可使用 repo Settings → Pages → Source: GitHub Actions。

本機 Windows 已有 Git Credential Manager 登入時，`python tools/github-release.py status` 可查詢；`enable-pages` 僅在使用者授權發布本倉庫時使用。工具不輸出 / 保存 token，讀取既有憑證後僅呼叫固定倉庫的 Pages / Actions API。`dispatch` 可手動觸發工作流程。

## 子路徑與快取

所有 HTML、圖片、模組和 manifest 使用相對 URL；Service Worker 以模組所在位置解析。禁止重新引入 `/assets/...` 或 `/src/...` 等網域根路徑。

本機可用 `http://localhost:5173/ash_protocol/?test=1` 模擬 GitHub 專案子路徑。Service Worker 在 HTTPS/localhost 生效、快取名稱含版本；新增必要檔案時同步更新 sw.js。

3.1.2 修正 Pages 的 HTTP 快取干擾：安裝新離線快取時使用 Request cache:reload，線上讀取使用 cache:no-cache 重新驗證。否則 Pages 的 max-age=600 會讓新 Service Worker 再存入舊 JS，導致部署已成功卻仍顯示舊 BUILD。離線仍讀既有快取，不清除玩家存檔。

正式 build 也會根據 HTML／CSS／JS 內容產生共同雜湊，將模組、CSS 及 SW URL 加上 ?v=雜湊；SW 清單使用相同 URL，快取名稱也含雜湊。即使尚未接管的新 SW 不能更新舊 HTTP 快取，新 HTML 仍會載入全新的依賴 URL。本機原始碼不改寫，這是 dist 的發布處理。

若正式遊戲仍在開啟狀態，部署不會強制中斷當前回合；重新整理載入新版。存檔沿用版本遷移。GitHub 與 localhost 是不同 origin，各自保有自己的存檔，可使用遊戲內匯出 / 匯入移轉。

## 3.19 入口回退

只有 SW 目錄的 ./ 與 ./index.html 的 GET 導覽可忽略查詢，先查當前 CACHE 的原請求，缺少再用預存 index.html。網路失敗或首頁 HTTP 錯誤都可回退。未知文件／JS／CSS 不可拿首頁代替，資源 ?v 雜湊仍精確比對，不使用跨版本 caches.match。QA namespace 依瀏覽器保留的 ?test=1 判斷，不因回傳 index.html 改成正式存檔。

至少須先連線成功安裝當前 SW 和預快取；首次從未載入或瀏覽器清除離線資料仍需網路。導航查詢不會改動主機或路徑；其他路徑不屬於此回退。Node 模擬測試不等於真實飛航模式，外部驗證需包含升級後尚未訪問過的新 query。
