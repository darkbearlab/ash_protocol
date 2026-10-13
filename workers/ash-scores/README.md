# ash-scores：每日排行榜後端

《灰燼協定》排名每日的伺服器：一個 Cloudflare Worker（`ash-scores`）加一個 D1 資料庫（`ash-scores-db`），跑在 `https://ash-scores.darkbearlab.workers.dev`。規則與防作弊見 [docs/LEADERBOARD.md](../../docs/LEADERBOARD.md)。

## 與帳號上其他東西的隔離

- 這個 Worker 只有一個 binding：自己的 D1（`DB` → `ash-scores-db`），沒有 Durable Object、KV 或其他資源。
- 所有 wrangler 指令都在**這個資料夾**用 `npm run …` 執行（`wrangler.toml` 的 `name = "ash-scores"`）；不要用 `--name`。在別的資料夾執行時，建置步驟會失敗，什麼都不會部署。
- 不碰 `chimera` Worker、它的 Durable Object 與任何資料；不讀 hex-world repo。

## 第一次設定

**已完成（2026-10-13，Claude 在使用者的電腦上做）**：資料庫 `ash-scores-db`（`9506726e-…`，APAC）、建表、部署、`DAILY_SECRET`（隨機 32 位元組，沒有留存，不需要知道）。以下是步驟紀錄，重新建一套時照做。在 `workers/ash-scores/` 裡（PowerShell 5.1 不認得 `&&`，指令要分開打或用 `;`）：

1. `npm ci`
2. `npx wrangler login`
3. `npx wrangler d1 create ash-scores-db`：把它印出的 `database_id` 填進 `wrangler.toml`（這個 ID 不是秘密，貼給 Claude 代填也可以）。
4. `npm run dry-run`：確認輸出的 binding 只有 `ash-scores-db` 和幾個環境變數。
5. `npm run migrate:remote`：在新資料庫建表。
6. `npm run deploy`
7. `npx wrangler secret put DAILY_SECRET`：輸入一段長亂數（例如 `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"` 的輸出）。這是每天種子與出擊票的簽章密鑰，**設定後不要再換**，換了以後當天的票全部失效、之後每天的種子也會跟著變。設定之前，API 一律回 503 `not-configured`。
8. 打開 `https://ash-scores.darkbearlab.workers.dev/v1/health` 確認 `ok: true`。

## 支援新的遊戲版本

伺服器用玩家那一版的遊戲引擎重播整局，所以每個要上榜的版本都要列在 `engines.json`：

```json
{ "versions": { "3.224.0": "v3.224.0" } }
```

值是那一版的 git tag（或 commit）。目前是 `"3.224.0": "df11e0f"`（3.224.0 的提交；以後的版本用 tag 或提交都可以，部署的機器上要有那個提交）。引擎直接從 git 讀出那個提交的 `src/`。每個版本會打包中、英兩份引擎（遊戲的文字表在載入時就決定語言）。版本太多時打包會變大（每版約 0.8 MB gzip），停用的舊版可以拿掉，那一版的榜就不再收新成績。`WORKTREE` 只供本機開發，CI 部署時會被擋下。

## 本機開發

```
# .dev.vars（不進 git）
DAILY_SECRET=local-dev-secret
DEV_ORIGINS=http://localhost:5174
MIN_MS_PER_OP=0
```

- `npm test`：用 Node 內建的 SQLite 模擬 D1，跑整套 API，包括一局真的重播驗證（`test/fixtures/`，通關機器人以排名每日規則打的一局）。
- `npm run migrate:local`、`npm run dev`：本機 workerd 實測（http://localhost:8787）。
- `npm run dry-run`：只打包、不部署。

## GitHub Actions（可選）

`.github/workflows/ash-scores.yml` 在 `workers/ash-scores/**` 或 `src/ranked-daily.js` 有變更時跑測試；repo 有 `CLOUDFLARE_API_TOKEN` 這個 secret 時才部署（先 dry-run、確認名字、跑 migration，再部署）。權杖請自己在 Cloudflare 建立，權限給 Account 的 **Workers Scripts: Edit** 與 **D1: Edit**。Cloudflare 的 Workers 權杖範圍是整個帳號，沒辦法只限一個 Worker，所以保護其他 Worker 靠的是這個工作流程只會在這個資料夾對 `ash-scores` 執行。

## API

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/v1/health` | 伺服器看到的 Origin、支援的版本、今天的日期 |
| GET | `/v1/daily?variant=standard` | 今天的設定（`spec`）與結束時間 |
| POST | `/v1/daily/tickets` | `{playerKey, variant?}` → `{ticket, spec, endsAt, submitBy}` |
| POST | `/v1/daily/runs` | `{ticket, playerKey, name, version, channel, language, log}`（`log` 是 gzip 後 base64 的操作紀錄）→ `{result, best:{rank,…}, newBest}` |
| GET | `/v1/daily/leaderboard?day=&variant=&version=&limit=&player=` | 榜單；`player` 是 `sha256("ash-player|"+playerKey)` 的前 32 個十六進位字 |
| GET | `/v1/daily/boards?day=&variant=` | 當天有哪些版本的榜 |

錯誤一律是 `{ok:false, error, reason?}`：`rate`（429）、`ticket-used`（409：同一張票正在檢查；已經存下成績的票再送會回 200 與 `repeat: true`）、`closed`（410）、`too-fast` / `rejected`（422，`reason` 是重播驗證的結果：`start`、`replay`、`params`、`unfinished`、`partial`、`version`、`language`…）。
