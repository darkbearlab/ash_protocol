# 聲音素材與產生程式

採用狀態、用途與接入現況以 [docs/AUDIO.md](../../docs/AUDIO.md) 為準。這裡只放**使用者採用的素材**和產生它們的程式（2026-09-17，使用者：只留採用的）。試聽合輯、比較檔、草稿、沒採用的版本都沒有進版本控制；需要時用產生程式重建。

全部是 Mega Drive 風格：44.1 kHz、16-bit、單聲道 WAV，保留製作時的相對音量，不逐檔正規化。

## adopted/：音效（15 項）

| 檔案 | 用途 | 狀態 |
| --- | --- | --- |
| `md-01-rifle-a.wav` | 突擊步槍開火 | 採用 |
| `md-04-shotgun.wav` | 霰彈槍開火 | 採用 |
| `md-07-hit.wav` | 命中 | 暫用 |
| `md-11-grenade.wav` | 爆炸 | 採用 |
| `md-12-footstep.wav` | 腳步 | 採用 |
| `md2-08-miss-a.wav` | 敵人用彈道武器攻擊玩家、沒打中；不用在玩家自己落空或近戰、電漿、毒液 | 採用 |
| `md2-15-ui-select.wav` | 選單確認 | 採用 |
| `md3-01-smg-single.wav` | 衝鋒槍，**一發**；每個實際射擊演出播一次（`.json` 有長度與雜湊） | 採用 |
| `md3-02-precision.wav` | 精準步槍開火 | 採用 |
| `md3-03-plasma-a.wav` | 電漿步槍開火 | 暫用 |
| `md3-04-kill.wav` | 擊殺 | 採用 |
| `md3-05-reload.wav` | 裝填 | 採用 |
| `md3-06-heal.wav` | 治療 | 採用 |
| `md3-07-transmission.wav` | 升級通訊 | 採用 |
| `md3-08-door.wav` | 氣動門 | 採用 |

## music/：配樂

| 檔案 | 用途 |
| --- | --- |
| `menu-theme.wav` | 出擊前選單〈待命〉；前奏播一次後循環，循環點在 `menu-theme-loop.json` |
| `loyalist-explore.wav`、`loyalist-combat.wav` | 忠誠者設施的探索與交戰，整檔循環 |
| `rebel-explore.wav`、`rebel-combat.wav` | 叛軍設施的探索與交戰，整檔循環 |
| `swarm-explore.wav`、`swarm-combat.wav` | 蟲族設施的探索與交戰，整檔循環 |
| `faction-loops.json` | 六段派系配樂的速度、長度、循環點與音符事件 |

## generators/：產生程式

沒有相依套件的 Node 腳本，亂數有固定種子。`md-engine.mjs` 是共用的 Mega Drive 音源近似（YM2612 FM、8 位元 DAC 取樣、SN76489 PSG、一代機輸出濾波）。

| 腳本 | 產生的採用素材 | 寫到哪裡 |
| --- | --- | --- |
| `md-sfx.mjs` | 步槍、霰彈槍、命中、爆炸、腳步 | `generators/out/` |
| `md-sfx-v2.mjs` | 敵彈落空、選單確認 | `generators/out-v2/` |
| `md-audio-round3.mjs` | 衝鋒槍單發、精準步槍、擊殺、裝填、治療、升級通訊、氣動門 | `round3/`，衝鋒槍單發直接寫 `adopted/` |
| `md-faction-sketches.mjs` | 電漿 A、六段派系配樂、`faction-loops.json` 的內容 | `faction-sketches/`（`manifest.json`） |
| `md-menu-theme.mjs` | 選單曲與循環點 | `music/` |

腳本也會產生沒採用的試聽輸出；那些資料夾與檔案列在 `.gitignore`。`audio-checksums.json` 記錄每個採用檔的 SHA-256，以及它是哪個產生輸出的逐位元組複本（2026-09-17 全部驗證一致）。

使用者試聽的方式：把檔案傳到使用者的 Telegram，用本機 tg_bridge 的 `tg_send.py`（`python tg_send.py <檔案> -c "說明"`）。
