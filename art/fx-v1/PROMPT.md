# FX v1 — GPT Image sources

2026-09-29. Built-in GPT Image, transparent background requested. Sources are proposals; only the processed indexed PNGs are game assets. No user retouch in this batch.

## fire

A production sprite sheet of ground fire for a top-down sci-fi tactical pixel game. Exactly 4 columns and 3 rows, equal square cells, no text or labels, transparent background. Each row is four phases of the SAME seamless short flickering loop, consistent anchor and scale. Row 1 newly ignited bright tall yellow-orange tongues. Row 2 steady compact orange burning floor. Row 3 low dark-red dying embers with occasional small orange lick. Thin gray drifting smoke at top of each fire. Not a campfire: no logs, no container, no ground slab. A loose patch of multiple flame tongues viewed from above with slightly visible front, irregular footprint; no round badge shape, no enclosing outlines. Tile patches must combine in a field with varied phases, soft irregular empty edges no tile border. True chunky 32x32 pixel-art look enlarged, limited 12-color amber/red/gray palette, no gradient or glow, no antialiasing, clear large clusters, generous consistent transparent margin. Output sheet 4:3 aspect.

## smoke

A production pixel-art sprite sheet of top-down smoke clouds for a dark sci-fi tactical game. Exactly 4 columns and 5 rows of equal square cells on genuinely transparent background, no labels no text. Each row four subtly different cyclic drifting phases of same cloud, consistent extent, origin and scale. Row 1 thick dense blue-gray smoke; row 2 much thinner sparse broken pale gray wisps with large transparent holes; row 3 white-cyan steam soft curled plumes; row 4 green toxic gas low rolling cloud; row 5 tan/brown spore haze flecked with tiny amber particles. Flat overhead clustered swirling shapes, NOT mushroom explosion, NOT side-view column, NOT round outlined badges. Clouds spread near cell edges but separated by narrow transparent gutters; irregular edges and interior holes help adjacent tiles combine. Simplified genuine 32x32 pixel sprites enlarged, blocky deliberate pixel clusters, THREE shades per smoke family, no fuzzy blur, no semitransparent gradients, no floor or scenery or tile border. On dark floor these will be composited at 50-85 percent opacity. 4:5 aspect.

## vent

Production top-down pixel sprite sheet: ONE consistent recessed industrial walkable floor exhaust grate, exactly 5 columns and 4 rows on transparent background. Orthographic overhead square dark gunmetal grate with four horizontal slats and tiny corner fasteners, flat and flush floor NOT a raised box. Identical metal geometry and position in EVERY cell. Rows differentiated ONLY small edge indicator strips: row1 blue-gray thick smoke, row2 muted gray thin smoke, row3 pale cyan steam, row4 lime-green toxic gas. Columns are states: 1 idle tiny dim indicators, 2 warning bright indicator, 3 warning dimmer indicator, 4 active bright glowing slit interiors, 5 active alternate lit slits. NO clouds, NO emitted smoke, NO fire, NO surrounding halo, no letters, numbers or labels. Exact 5x4 equal square grid, generous transparent separation. Genuine chunky 32x32 pixel-art style enlarged, limited palette, hard edges no antialiasing or gradients. 5:4 aspect.

## flame-burst

A single horizontal animation sprite strip of a flamethrower jet effect for top-down tactical pixel game: EXACTLY FOUR equal square cells in one row, transparent background, NO weapon NO character NO text. Each cell is one frame: ignition short jet, full broad fast tongue, turbulent split tongues, brief dissipating orange flame. Direction always from LEFT toward RIGHT, centered on y midpoint; source at left center and flame tip right center. Warm white-yellow core, yellow orange body, dark red edge accents, only 7 colors, no black outline no glow no smoke background. Fits within each cell with consistent narrow transparent margins. This effect will repeat on cells in a cone and rotate to face four directions. Genuine native 32x32 chunky pixel-art look enlarged, crisp stepped contours, large readable clusters, NO fine highres texture NO blur NO gradient. Four frames total. 4:1 aspect.

## loot-flamer

No new image generation. Preserve the current adopted generic weapon/corner silhouette from source-loot-reference.png, first cell; recolour to fuel orange-red, reduce to RGB5 indexed colours and hard alpha as required by FX_SPRITES_BRIEF.
