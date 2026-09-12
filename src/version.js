// The one place the game version lives (3.44.1). `npm run bump -- x.y.z` rewrites it together with package.json
// and the sw.js cache name; tests/release.test.mjs fails if the three disagree.
export const VERSION='3.54.2';
