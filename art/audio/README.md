# 聲音素材與產生程式

聲音的方向、使用者的每輪回饋和待辦在 [docs/AUDIO.md](../../docs/AUDIO.md)；標題音樂規格在 [docs/MENU_MUSIC.md](../../docs/MENU_MUSIC.md)。這裡只放檔案。

**還沒有任何聲音接進遊戲。** 遊戲目前仍用 `src/audio.js` 的舊合成音效。

## adopted/：使用者已採用的音效（Mega Drive 風格）

| 檔案 | 用途 | 狀態 |
| --- | --- | --- |
| `md-01-rifle-a.wav` | 突擊步槍開火 | 採用 |
| `md-04-shotgun.wav` | 霰彈槍開火 | 採用 |
| `md-07-hit.wav` | 命中 | 暫時採用 |
| `md-11-grenade.wav` | 爆炸 | 採用 |
| `md-12-footstep.wav` | 腳步 | 採用 |
| `md2-08-miss-a.wav` | **敵人用彈道武器攻擊玩家、沒打中**（子彈打進牆面的碎屑聲）；不用在近戰、電漿、毒液等非彈道攻擊，也不是玩家自己落空 | 採用 |
| `md2-15-ui-select.wav` | 選單確認 | 採用 |

格式：44.1 kHz、16-bit、單聲道 WAV。所有音效用同一個輸出增益（最大峰值 −1 dBFS），彼此的相對音量就是設計比例；接進遊戲時不要逐個正規化。

## generators/：產生程式

全部是沒有相依套件的 Node 腳本，亂數有固定種子，重跑會得到逐位元組相同的檔案（2026-09-17 已驗證 adopted/ 七個檔案）。

| 檔案 | 內容 | 輸出 |
| --- | --- | --- |
| `nes-sfx.mjs` | 紅白機 2A03 風格第一輪（16 個，使用者覺得很紅白機，但後來選了 Mega Drive 方向） | `out-nes/` |
| `md-sfx.mjs` | Mega Drive 第一輪（16 個，合成器寫在檔案裡） | `out/` |
| `md-engine.mjs` | Mega Drive 合成器本體：YM2612 FM 近似、8 位元 DAC 取樣播放、SN76489 PSG、一代機輸出濾波 | — |
| `md-sfx-v2.mjs` | Mega Drive 第二輪（21 個，使用 `md-engine.mjs`，輸出增益與第一輪相同） | `out-v2/` |

```sh
cd art/audio/generators
node md-sfx.mjs
node md-sfx-v2.mjs
```

輸出資料夾不進版本控制（見 `.gitignore`）。每個腳本另外輸出一個把全部串起來的試聽檔（`*-00-sampler.wav`）和開始秒數清單（`*-00-index.txt`）。

使用者試聽的方式：把試聽檔傳到使用者的 Telegram，用本機 tg_bridge 的 `tg_send.py`（`python tg_send.py <檔案> -c "說明"`）。
