// Ai's News ローカル確認用サーバー
// 本番公開はGitHub Pages(docs/ をそのまま配信し、GitHub Actionsが6時間ごとに記事を更新)。
// このサーバーは手元で動作確認したい場合のみ使う:
//   - docs/ を静的配信
//   - 記事データが無い/古い場合は起動時に収集、起動中は6時間ごとに自動収集

import express from 'express';
import cron from 'node-cron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAll } from './fetcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTICLES_PATH = path.join(__dirname, 'docs', 'data', 'articles.json');
const PORT = process.env.PORT || 3456;

const app = express();
app.use(express.static(path.join(__dirname, 'docs')));

app.listen(PORT, () => {
  console.log(`Ai's News (local preview) -> http://localhost:${PORT}`);
});

// 起動時: 記事データが無い/6時間以上古い場合は取得
(async () => {
  let stale = true;
  try {
    const data = JSON.parse(await fs.readFile(ARTICLES_PATH, 'utf8'));
    stale = !data.updatedAt || Date.now() - new Date(data.updatedAt).getTime() > 6 * 60 * 60 * 1000;
    if (!stale) console.log(`[server] articles up to date (${data.updatedAt}, ${data.count} articles)`);
  } catch { /* データ無し */ }
  if (stale) fetchAll().catch((e) => console.error('[startup fetch]', e.message));
})();

// 6時間ごとに自動更新
cron.schedule('15 */6 * * *', () => {
  fetchAll().catch((e) => console.error('[cron fetch]', e.message));
});
