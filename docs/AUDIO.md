# 聲音與音樂：目前採用與接入交接

更新：2026-09-17。使用者已認可所有本批音樂；電漿暫用 A，之後可改。**素材獲准採用不代表已接入遊戲**；目前遊戲 3.116.0 仍用 src/audio.js 舊合成提示音，沒有音樂播放。先前每輪完整回饋保存於 [製作歷史](archive/audio-production-2026-09-17.md)，若歷史文字衝突，以本檔為準。

## 已決定的方向

- 全部使用 Mega Drive 風格；既有合成器是近似音源，不宣稱逐暫存器實機相容。
- 出擊前選單播放〈待命〉。戰場探索播放不安、稀疏的氛圍配樂，交戰改播當層派系戰鬥音樂。
- 忠誠者、叛軍、蟲族六段配樂均採用。這不是寫實通風／機械底噪；vent/reactor 舊草稿不採用。
- 玩家試聽使用 Telegram。音檔、製作來源、數值檢查已留存；遊戲內混音與切換尚未驗收。

> **2026-09-17 整理（使用者：只留採用的）**：Codex 的四筆素材提交合成一筆，只保留採用的檔案。試聽合輯、比較檔、MP3 預覽、草稿、沒採用的環境音與電漿 B、三發衝鋒槍試聽檔、獨立循環母帶都沒有進版本控制；電漿 A 移到 `adopted/md3-03-plasma-a.wav`，六段派系配樂與 `faction-loops.json`（原 manifest）移到 `music/`。每個採用檔與產生輸出的對應與雜湊見 `art/audio/audio-checksums.json`。下文若提到已不存在的預覽或比較檔，只是製作歷史。

## 音效採用表（15 項）

以下路徑以 art/audio/ 為根；不必重新產生或從比較用 MP3 擷取。

| 用途 | 檔案 | 狀態／限制 |
| --- | --- | --- |
| 步槍 | adopted/md-01-rifle-a.wav | 採用 |
| 霰彈槍 | adopted/md-04-shotgun.wav | 採用 |
| 命中 | adopted/md-07-hit.wav | 暫用 |
| 爆炸 | adopted/md-11-grenade.wav | 採用 |
| 腳步 | adopted/md-12-footstep.wav | 採用 |
| 敵人彈道攻擊玩家落空 | adopted/md2-08-miss-a.wav | 不用於玩家落空、近戰、電漿、毒液 |
| 選單確認 | adopted/md2-15-ui-select.wav | 採用 |
| 衝鋒槍 | adopted/md3-01-smg-single.wav | 單發已匯出並核對；舊三發檔只供試聽 |
| 精準步槍 | adopted/md3-02-precision.wav | 採用 |
| 擊殺 | adopted/md3-04-kill.wav | 採用 |
| 裝填 | adopted/md3-05-reload.wav | 採用 |
| 治療 | adopted/md3-06-heal.wav | 採用 |
| 升級通訊 | adopted/md3-07-transmission.wav | 採用 |
| 氣動門 | adopted/md3-08-door.wav | 採用 |
| 電漿 | adopted/md3-03-plasma-a.wav | 暫用 A；B 不採用，不須重新試選 |

WAV 為 44.1 kHz、16-bit、mono。保留製作時的相對音量，不逐檔正規化。第三輪音效若超過峰值限制有單檔衰減，不應假設每檔完全相同增益。

## 音樂檔案與循環接口

| 用途 | art/audio/ 下的來源 | 循環 |
| --- | --- | --- |
| 出擊前選單 | music/menu-theme.wav | 前奏一次，之後循環 |
| 忠誠者探索／戰鬥 | music/loyalist-explore.wav、loyalist-combat.wav | 整檔 |
| 叛軍探索／戰鬥 | music/rebel-explore.wav、rebel-combat.wav | 整檔 |
| 蟲族探索／戰鬥 | music/swarm-explore.wav、swarm-combat.wav | 整檔 |

- 〈待命〉88 BPM，全長 79.090907 秒；前奏 120273 samples（2.727279 秒），loopEnd=3487909 samples（79.090907 秒），循環長 76.363628 秒。rate=44100。讀 music/menu-theme-loop.json，不手抄近似秒數。menu-theme-loop.wav 是相同循環區的獨立母帶。
- 派系配樂：探索各 26.667 秒／72 BPM；戰鬥忠誠者 18.462 秒／104 BPM、叛軍 17.143 秒／112 BPM、蟲族 16 秒／120 BPM。精確長度與音符事件見 faction-sketches/manifest.json。短循環已獲使用者採用，不必擅自延長。
- 所有 comparison／preview MP3 僅供試聽，包含一秒分隔的比較檔不能當正式曲。正式循環用來源 WAV 或接入時轉換並驗證的壓縮檔。
- 完整選單音樂實測 -19.8 LUFS、true peak -6.6 dBFS；派系音樂仍需在遊戲音效同播時調混音，不用數值接點檢查取代人耳驗收。
- 原始工程為 Node 製作腳本，不是 FamiStudio/Furnace/MIDI；NES 四聲部委託已被 Mega Drive 決定取代。來源：generators/md-menu-theme.mjs、md-faction-sketches.mjs、md-audio-round3.mjs，共用 md-engine.mjs。

衝鋒槍單發交付：6152 samples／44.1 kHz，約 0.1395 秒。直接重用已採用三發生成資料中的第一發與相同增益，保留濾波尾音；前 3900 PCM samples 與舊檔一致。來源 md-audio-round3.mjs，重跑不改原批次任何 WAV。完整接手步驟見 [給 Claude 的音訊交接](AUDIO_INTEGRATION_HANDOFF.md)。

## 尚未接入：交給下一輪的工作

1. 遊戲播放與資產：仍在 art，不在網站產物。挑正式格式搬到 assets，列入 sw.js，保留 /ash_protocol/ 相對路徑；派系壓縮檔尚未製作。解碼一次、重用 buffer，設定同時音效上限。
2. 輸出選擇：音效依射擊武器與演出事件播放；連發按事件發數，使用 md3-01-smg-single.wav，不能每發播整個舊三發檔。維持子彈抵達、受擊、倒下、升級的演出順序；處理跳過演出時的排程取消，避免音效滯後。
3. 音樂狀態：menu／explore／combat；按當層派系選曲，無盡換層要跟著切換。不可直接依 enemy.alert（警戒不會自動清除），不可讓牆後未知敵人透過配樂洩漏資訊。使用者已決定交戰時換曲；具體交戰／脫戰判定、退場延遲與淡化秒數尚未定案。
4. 操作：音樂／音效分開音量與靜音、首次使用者手勢解鎖音訊、頁面切到背景／回來、暫停與陣亡／結算時的策略、舊 ash-sound 設定相容。尚未實作。
5. 未有獨立素材或明確對應：玩家自己落空、手槍／輕機槍／近戰／毒液等未列類型可先規劃共用或靜音，不能把敵彈落空聲套在全部 miss。legacy、Kill house 與未來派系的音樂備援也尚未決定。

建議起點（提案，非使用者定案）：以玩家可感知的近期交火／威脅接觸進 combat；無接觸後延遲返回 explore；交叉淡化，不每回合重開曲頭。不同模式速度不一樣，不要求硬接同一小節。

## 驗收界線與待測

- 已做：來源 WAV 無截波、循環長度與接點檢查；選單母帶循環區與獨立循環 PCM 一致；前批重製雜湊一致；build 通過。
- 使用者已做：素材試聽採用。沒有因此宣稱遊戲內或手機瀏覽器的播放驗收通過。
- 接入後要測：首次點擊出聲、離線重開、音量／靜音持久化、各派系與無盡換層、交戰進退與不洩漏未知敵人、快速連續輸入、死亡演出、背景恢復、壓縮音樂循環與長時間重疊音量。
- 本輪只更新文件，不更動遊戲／存檔、不升版本。依最新流程本機提交，等使用者放行推送。
