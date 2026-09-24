# 管制員臉譜第一輪：白鷺、鷦鷯 4×4 表情圖集

2026-09-24，使用者授權以 GPT Image（gpt-image-2，2048×2048，high）各產一張 4×4 表情圖集，之後由 `tools/pixelize_comms_portraits.py` 固定流程處理：相似色合併、壓進 Mega Drive 色票（每色版 3 bit，每人一張 16 色共用色盤）、真像素化成 64×64。角色設定見 docs/STORY.md 第 8 節。

## 白鷺 Egret（source-egret.png）

```text
Use case: game asset, character expression sheet.
Asset type: ONE sprite atlas, exactly 4 columns x 4 rows, 16 cells showing the SAME character with 16 different facial expressions.
Style: authentic hand-designed low-resolution 16-bit console pixel art, Sega Mega Drive / Genesis era character portrait. Design each face as if drawn directly on a 64x64 pixel canvas, then enlarged with nearest-neighbor. Large deliberate pixel clusters, hard square pixels, one consistent virtual pixel grid across the whole image. Do NOT paint a detailed anime illustration and apply a pixel filter.
Character (identical in every cell): a young adult woman, the mission controller of a sci-fi military operation. Long straight silver hair with a side-swept fringe that covers one side of her forehead down to that eye's brow line, the other eye fully visible; pale skin; a calm, gentle, innocent look; pale blue-grey eyes. She wears a slim communications headset with a small boom microphone on one side, and a high-collared dark navy operator uniform with one thin teal accent line.
Layout: perfectly regular 4x4 equal square cells filling a square image. Solid dark navy background in every cell, NO gutters, NO grid lines, NO frames, NO labels, NO text. Head and shoulders centered, front view, same head size, same eye height and same framing in every cell. Leave a clear margin so the hair never crosses a cell boundary.
Expressions in row-major order:
Row 1: calm neutral; faint gentle smile; speaking calmly with the mouth slightly open; attentive, listening.
Row 2: serious and focused; concerned; worried with brows raised in the middle; alarmed warning with wide eyes.
Row 3: surprised; quietly sad with lowered eyes; relieved small smile; thinking with eyes looking to the side.
Row 4: eyes closed, composed; determined; slightly flustered with a faint blush; soft sincere smile.
Pixel design: 16 colors maximum for the whole sheet; broad 2-tone skin shading with one highlight; hair in 3 to 5 large clumps with 3 tones; small eyes with a 1-pixel glint; the nose a short cluster; the mouth a short line. Bold dark outline. Flat opaque colors. NO antialiasing, gradients, dithering, texture, film grain, individual hair strands, eyelashes or micro details.
Constraints: adult character, original design, no famous characters, no text, no logos, no watermark.
```

## 鷦鷯 Wren（source-wren.png）

```text
Use case: game asset, character expression sheet.
Asset type: ONE sprite atlas, exactly 4 columns x 4 rows, 16 cells showing the SAME character with 16 different facial expressions.
Style: authentic hand-designed low-resolution 16-bit console pixel art, Sega Mega Drive / Genesis era character portrait. Design each face as if drawn directly on a 64x64 pixel canvas, then enlarged with nearest-neighbor. Large deliberate pixel clusters, hard square pixels, one consistent virtual pixel grid across the whole image. Do NOT paint a detailed anime illustration and apply a pixel filter.
Character (identical in every cell): a young adult woman, a mission controller of a sci-fi military operation with a casual, lively, slightly mischievous attitude. Silver hair cut in a short chin-length bob with blunt bangs; light skin; warm amber eyes. She wears a slim communications headset with a small boom microphone on one side, and a dark navy operator uniform with one thin teal accent line, the high collar loosened and unbuttoned at the top.
Layout: perfectly regular 4x4 equal square cells filling a square image. Solid dark navy background in every cell, NO gutters, NO grid lines, NO frames, NO labels, NO text. Head and shoulders centered, front view, same head size, same eye height and same framing in every cell. Leave a clear margin so the hair never crosses a cell boundary.
Expressions in row-major order:
Row 1: relaxed neutral; wide cheerful grin; talking casually with the mouth open; playful wink.
Row 2: bored with half-lidded eyes; annoyed pout; serious for once; alarmed shout with wide eyes.
Row 3: surprised; sheepish laugh; worried; smug smirk.
Row 4: laughing with eyes closed; tired sigh; determined; sad.
Pixel design: 16 colors maximum for the whole sheet; broad 2-tone skin shading with one highlight; hair in 3 to 5 large clumps with 3 tones; small eyes with a 1-pixel glint; the nose a short cluster; the mouth a short line. Bold dark outline. Flat opaque colors. NO antialiasing, gradients, dithering, texture, film grain, individual hair strands, eyelashes or micro details.
Constraints: adult character, original design, no famous characters, no text, no logos, no watermark.
```

## 白鷺第二版（source-egret.png，2026-09-24 重產；第一版改名 source-egret-r1.png）

使用者：膚色再淡一點、瀏海剪短讓雙眼露出來、眉毛平一點；嘴巴可能因取樣沒對齊而歪掉（取樣另外修）。

```text
Use case: game asset, character expression sheet.
Asset type: ONE sprite atlas, exactly 4 columns x 4 rows, 16 cells showing the SAME character with 16 different facial expressions.
Style: authentic hand-designed low-resolution 16-bit console pixel art, Sega Mega Drive / Genesis era character portrait. Design each face as if drawn directly on a 64x64 pixel canvas, then enlarged with nearest-neighbor so that every virtual pixel is exactly 8x8 image pixels, the grid starting at the top-left corner of every cell. Large deliberate pixel clusters, hard square pixels, one consistent virtual pixel grid across the whole image. Do NOT paint a detailed anime illustration and apply a pixel filter.
Character (identical in every cell): a young adult woman, the mission controller of a sci-fi military operation. Long straight silver hair falling past the shoulders; her side-swept bangs are cut short, ending above the eyebrows, so BOTH eyes are fully visible and unobstructed. Very fair, pale porcelain skin (lighter than a typical peach tone). Straight, level eyebrows that stay nearly horizontal, not arched and not slanted. A calm, gentle, innocent look; pale blue-grey eyes. The face is symmetrical, with the nose and the mouth centered under the midpoint between the eyes. She wears a slim communications headset with a small boom microphone on one side, and a high-collared dark navy operator uniform with one thin teal accent line.
Layout: perfectly regular 4x4 equal square cells filling a square image. Solid dark navy background in every cell, NO gutters, NO grid lines, NO frames, NO labels, NO text. Head and shoulders centered, front view, same head size, same eye height and same framing in every cell. Leave a clear margin so the hair never crosses a cell boundary.
Expressions in row-major order:
Row 1: calm neutral; faint gentle smile; speaking calmly with the mouth slightly open; attentive, listening.
Row 2: serious and focused; concerned; worried with the brows raised a little in the middle; alarmed warning with wide eyes.
Row 3: surprised; quietly sad with lowered eyes; relieved small smile; thinking with eyes looking to the side.
Row 4: eyes closed, composed; determined; slightly flustered with a faint blush; soft sincere smile.
Pixel design: 16 colors maximum for the whole sheet; broad 2-tone skin shading with one highlight; hair in 3 to 5 large clumps with 3 tones; small eyes with a 1-pixel glint; the nose a short cluster; the mouth a short line centered on the face. Bold dark outline. Flat opaque colors. NO antialiasing, gradients, dithering, texture, film grain, individual hair strands, eyelashes or micro details.
Constraints: adult character, original design, no famous characters, no text, no logos, no watermark.
```
