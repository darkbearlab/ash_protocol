# 故事草稿（3.190.0 起從遊戲撤下）

使用者 2026-09-26：凍結版本前，不想把還沒寫完的故事碎片推出去。原本在 `content/stories/` 的 22 段故事原封不動搬到這裡，遊戲不讀這個資料夾（`npm run stories` 只編譯 `content/stories/`，建置也不複製 `content/`）。

`content/stories/` 留著同樣的檔名與 `id`、`faction`、`floors`、`order`，標題改成 `ENCRYPTED`、內文改成 `TO BE DECRYPTED`（中英文都顯示這兩個字），所以玩家已經解鎖的紀錄照樣保留，之後換回內容就會直接看到。

## 放回遊戲

1. 把寫好的檔案複製回 `content/stories/`，覆蓋同名的佔位檔（`id` 不要改，改了等於刪掉舊故事，見 `content/stories/README.md`）。
2. 全部寫完後，把 `src/unlock-catalog.js` 的 `UNLOCK_SETTINGS.storiesWip` 改成 `false`：解鎖頁拿掉 DECRYPTION IN PROGRESS 章、恢復購買，撿到資料時紀錄改回顯示內文。
3. 同時改回說明文字（`unlock-ui.help`、`unlock-ui.note`，中英兩表）與 `content/stories/README.md` 的「也能購買」。
4. 故事有英文之前，英文模式會顯示中文：記得把 `qa/english-scan.mjs` 與 `tests/i18n-english.test.mjs` 的故事例外加回來，並更新 docs/TEXT_INVENTORY.md 第十四節。
5. 執行 `npm run stories` 並提交 `src/story-data.js`。
