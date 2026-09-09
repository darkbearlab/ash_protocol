# 發布與 GitHub Pages

使用者的持續要求：每次完成工作都推至 `https://github.com/darkbearlab/ash_protocol`，並整合到 **main**。不要只留下分支或本機修改；不要 force push main。

遊戲網址：`https://darkbearlab.github.io/ash_protocol/`。

## 每次交付

1. 在正式任務以外的 `?test=1` 頁面檢查 UI。
2. `npm test`、`npm run build` 必須成功。
3. 更新 HANDOFF、DESIGN 和 CHANGELOG。
4. `git status` 確認沒有秘密、暫存檔或未預期檔案。
5. commit 後推至 origin/main；若用了分支，先正常合併到 main，禁止覆蓋遠端歷史。
6. 驗證 `.github/workflows/pages.yml` 成功，再到線上網址確認 BUILD 版本和素材載入。

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
