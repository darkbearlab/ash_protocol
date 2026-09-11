// 用法：npm run bump -- 3.45.0
// 一次改齊版本號的三個位置：package.json、src/version.js、sw.js 的快取名稱。
// tests/release.test.mjs 會檢查三者一致；說明頁與設定的 BUILD 字樣直接讀 src/version.js。
import {readFileSync, writeFileSync} from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('用法：npm run bump -- x.y.z');
  process.exit(1);
}
const root = new URL('../', import.meta.url);
const edit = (file, pattern, replacement) => {
  const url = new URL(file, root), text = readFileSync(url, 'utf8');
  if (!pattern.test(text)) throw new Error(`${file}：找不到版本欄位`);
  writeFileSync(url, text.replace(pattern, replacement));
};
edit('package.json', /"version": "\d+\.\d+\.\d+"/, `"version": "${version}"`);
edit('src/version.js', /VERSION='\d+\.\d+\.\d+'/, `VERSION='${version}'`);
edit('sw.js', /const CACHE='ash-protocol-v[\d-]+'/, `const CACHE='ash-protocol-v${version.replaceAll('.', '-')}'`);
console.log(`版本已改為 ${version}：package.json、src/version.js、sw.js`);
