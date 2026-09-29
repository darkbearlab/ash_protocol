# 發布與 GitHub Pages

遊戲網址：`https://darkbearlab.github.io/ash_protocol/`。倉庫：`https://github.com/darkbearlab/ash_protocol`，整合到 **main**，不要 force push main。推送要使用者同意：做完先提交，使用者說推才推（「做完後推上去」這類指示就是同意）。

## 每次交付（3.206.1 起）

1. 版本號：`npm run bump -- x.y.z`，一次改 `package.json`、`src/version.js`、`sw.js` 的快取名稱；`tests/release.test.mjs` 會在三者不一致時失敗。
2. 交件檢查照 [CHECKLIST.md](CHECKLIST.md) 第 1 節：完整 `npm test`、動到存檔或敵人招式時跑存檔隨機測試、身分基準、改到文字時跑英文檢查、`npm run build`。同一份沒改過的程式，通過的結果可以沿用。
3. 文件：
   - CHANGELOG 新版本放最上面：做了什麼、使用者的決定與 Claude 自己的判斷、驗證數字、審查結果；**最後一行「試玩重點：」**寫使用者要實際看的地方（取代舊的驗證紙條，使用者 2026-09-29 同意）。
   - `qa/results/` 寫一份精簡報告：需求、做法、驗證（自己跑的與代理跑的分開寫）、審查找到什麼與怎麼修；CHANGELOG 已經寫的不重複。
   - 對應規格照改；HANDOFF 只在架構、存檔、指令改變時更新。
4. `git status` 確認只 stage 本批檔案，沒有秘密或暫存檔。
5. 先 `git fetch`，確認 `origin/main` 是目前提交的祖先，再 `git push origin HEAD:main`。`[skip ci]` 的提交不要疊在程式提交上面一起推，不然整批都不會部署。
6. `python tools/github-release.py status` 確認**這個 SHA** 的 Pages 工作流程 completed／success，線上 `src/version.js` 是新版本。部署結果補進報告（可以之後用 `[skip ci]` 的文件提交）。

新增 `src/` 模組時，同步加進 `sw.js` 的 `FILES` 與 `index.html` 的 `data-modules` 數量（測試會檢查）。

## 純文件交付

只改不影響執行的 Markdown：檢查差異、連結與指示有沒有矛盾，提交並推 main（同樣要使用者同意）；不升遊戲版本、不跑遊戲測試。提交訊息加 `[skip ci]`，交付時說明線上遊戲不變。

## 查詢與結束

發布只追蹤本次 SHA 的一個工作流程，等它完成就好，不重跑已經通過的檢查。

## 自動部署

未標記跳過 CI 的 push main，GitHub Actions 先把 Node 22 測試分成 4 份平行執行（`node --test --test-shard=N/4`，2026-09-19 起；單一工作要 8～9 分鐘），4 份都通過後才建置，並將 **dist/** 作為 Pages artifact 發布。原始美術 `art/`、文件、測試、Git 資料與輔助工具不在網站產物中。

Pages 設定使用 **GitHub Actions** 作為來源。完成一次設定後，後續 main push 自動部署。首次尚未啟用時可使用 repo Settings → Pages → Source: GitHub Actions。

本機 Windows 已有 Git Credential Manager 登入時，`python tools/github-release.py status` 可查詢；`enable-pages` 僅在使用者授權發布本倉庫時使用。工具不輸出 / 保存 token，讀取既有憑證後僅呼叫固定倉庫的 Pages / Actions API。`dispatch` 可手動觸發工作流程。

## 子路徑與快取

所有 HTML、圖片、模組和 manifest 使用相對 URL；Service Worker 以模組所在位置解析。禁止重新引入 `/assets/...` 或 `/src/...` 等網域根路徑。

本機可用 `http://localhost:5174/ash_protocol/?test=1` 模擬 GitHub 專案子路徑。Service Worker 在 HTTPS/localhost 生效、快取名稱含版本；新增必要檔案時同步更新 sw.js。

3.1.2 修正 Pages 的 HTTP 快取干擾：安裝新離線快取時使用 Request cache:reload，線上讀取使用 cache:no-cache 重新驗證。否則 Pages 的 max-age=600 會讓新 Service Worker 再存入舊 JS，導致部署已成功卻仍顯示舊 BUILD。離線仍讀既有快取，不清除玩家存檔。

正式 build 也會根據 HTML／CSS／JS 內容產生共同雜湊，將模組、CSS 及 SW URL 加上 ?v=雜湊；SW 清單使用相同 URL，快取名稱也含雜湊。即使尚未接管的新 SW 不能更新舊 HTTP 快取，新 HTML 仍會載入全新的依賴 URL。本機原始碼不改寫，這是 dist 的發布處理。

3.198.4 起，帶 `?v=` 的請求（頁面載入除外）先查這一版的離線快取，有就直接用，沒有才上網。同一個指紋的內容不會變，而且快取是在安裝時用 `cache:'reload'` 抓的，所以不會拿到舊檔。主頁面、`sw.js`、圖片、聲音，以及開發伺服器上沒有指紋的檔案，照舊先上網再退回快取。這一段由 tests/offline.test.mjs 鎖住。

`index.html` 裡唯一的內嵌腳本（開啟畫面讀取條，3.198.3）必須放在所有樣式表之前。放在樣式表之後的內嵌腳本，要等樣式表（包含 Google Fonts）載完才會執行，會卡住整頁的解析，程式檔也跟著晚開始載（tests/boot-progress.test.mjs 會檢查）。

若正式遊戲仍在開啟狀態，部署不會強制中斷當前回合；重新整理載入新版。存檔沿用版本遷移。GitHub 與 localhost 是不同 origin，各自保有自己的存檔，可使用遊戲內匯出 / 匯入移轉。

## itch.io 凍結版（3.199.0 起）

使用者 2026-09-28 決定：第一個公開版本放 itch.io，開發版照舊推 main、部署到 GitHub Pages。

使用者 2026-09-29：itch.io 上的凍結版從現在起不再更新，除非有特殊理由。main 的新功能（3.200.0 起）只部署到 GitHub Pages，不重新打包上傳。

- **凍結版就是上傳到 itch.io 的 zip**：
  - itch.io 保存上傳的檔案，要等下次上傳才會變。
  - 不另開 repo，也不在 repo 裡放凍結目錄。
  - 原因：`darkbearlab.github.io` 底下的任何路徑都是同一個網站，會跟開發版共用存檔（存檔名稱不分路徑）。開發版 Service Worker 的範圍也涵蓋子目錄。
- **打包**：
  - `npm run itch` 先 build，再把 dist/ 打成 `release/ash-protocol-<版本>-itch.zip`（`release/` 不進 git）。
  - index.html 在 zip 根目錄；所有路徑都是相對的，itch.io 從 `/html/<上傳編號>/` 提供也能跑。
  - 同一份程式每次打出來的 zip 完全相同。
  - 超過 itch.io 的上限（1000 個檔案、解壓後 500 MB）會直接報錯。
- **上傳**（使用者操作）：
  - itch.io 專案的 Kind of project 選 HTML。
  - 上傳 zip，勾「This file will be played in the browser」。
  - 手機優先的話，勾 Mobile friendly，視窗尺寸設直式。
- **凍結紀錄**：
  - 在凍結的 commit 打標籤 `v<版本>`，GitHub Release 附上同一個 zip。
  - main 的下一版直接跳下一個小版本號，例如凍在 3.199.0，main 下一版是 3.200.0。
- **凍結版要修 bug**：
  1. 先在 main 修好。
  2. 從標籤開 `release/<版本>` 分支，把修正搬過去。
  3. 用修補版號（3.199.1、3.199.2…），不會跟 main 撞號。
  4. `npm run itch` 重新打包，再上傳 itch.io；新的 zip 同樣附在該版本的 Release 上。
- **存檔**：
  - itch.io 與 GitHub Pages 是不同網域，存檔各自獨立。
  - 玩家要搬存檔，用遊戲內的匯出／匯入。
- **Service Worker**：安裝時資料夾網址（`./`）抓不到也沒關係（3.199.0），不會因為主機不回應資料夾網址就整個沒有離線快取。

## 3.19 入口回退

只有 SW 目錄的 ./ 與 ./index.html 的 GET 導覽可忽略查詢，先查當前 CACHE 的原請求，缺少再用預存 index.html。網路失敗或首頁 HTTP 錯誤都可回退。未知文件／JS／CSS 不可拿首頁代替，資源 ?v 雜湊仍精確比對，不使用跨版本 caches.match。QA namespace 依瀏覽器保留的 ?test=1 判斷，不因回傳 index.html 改成正式存檔。

至少須先連線成功安裝當前 SW 和預快取；首次從未載入或瀏覽器清除離線資料仍需網路。導航查詢不會改動主機或路徑；其他路徑不屬於此回退。Node 模擬測試不等於真實飛航模式，外部驗證需包含升級後尚未訪問過的新 query。
