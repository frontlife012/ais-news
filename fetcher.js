// 記事収集エンジン
// 各ソースのRSS/Google Newsフィードを取得し、data/articles.json に正規化して保存する。
// 出典(publisher/リンク)を必ず保持し、本文は「見出し+短い抜粋」のみ
// (著作権法上の引用の範囲に収める。全文転載はしない)。
// 英語記事のタイトル・抜粋は取得時に日本語へ自動翻訳する(翻訳済みはキャッシュ再利用)。

import Parser from 'rss-parser';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// GitHub Pagesで配信するため、記事データはサイト本体(docs/)内に出力する
const DATA_DIR = path.join(__dirname, 'docs', 'data');
const ARTICLES_PATH = path.join(DATA_DIR, 'articles.json');

const MAX_PER_SOURCE = 40;
const EXCERPT_LEN = 220;
const OG_IMAGE_LOOKUPS_PER_SOURCE = 10; // og:image取得は重いので件数を絞る
const FETCH_TIMEOUT_MS = 15000;

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIsNews/1.0' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['source', 'gnewsSource'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

function hashId(text) {
  return crypto.createHash('md5').update(text).digest('hex').slice(0, 16);
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickImage(item) {
  if (Array.isArray(item.mediaContent)) {
    for (const m of item.mediaContent) {
      const url = m?.$?.url;
      if (url && /^https?:/.test(url)) return url;
    }
  }
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url && /image|jpg|jpeg|png|webp|gif/i.test(item.enclosure.type || item.enclosure.url)) {
    return item.enclosure.url;
  }
  const html = item.contentEncoded || item.content || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m && /^https?:/.test(m[1])) return m[1];
  return null;
}

// Google Newsの記事タイトルは「見出し - 媒体名」形式なので分離する
function splitGnewsTitle(title) {
  const idx = title.lastIndexOf(' - ');
  if (idx > 10) {
    return { title: title.slice(0, idx).trim(), publisher: title.slice(idx + 3).trim() };
  }
  return { title, publisher: null };
}

function publisherFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function fetchOgImage(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIsNews/1.0' }
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200000);
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (m && /^https?:/.test(m[1])) return m[1];
    return null;
  } catch {
    return null;
  }
}

// ---------- 日本語自動翻訳 ----------

const JA_RE = /[぀-ヿ㐀-鿿]/; // ひらがな・カタカナ・漢字

async function translateJa(text) {
  if (!text || JA_RE.test(text)) return null; // 既に日本語なら翻訳不要
  try {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=' +
      encodeURIComponent(text.slice(0, 1500));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AIsNews/1.0' }
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const ja = (data?.[0] || []).map((seg) => seg?.[0] || '').join('').trim();
    return ja || null;
  } catch {
    return null;
  }
}

// 同時実行数を抑えてタスクを順に処理する
async function runPool(tasks, limit = 6) {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const task = queue.shift();
      await task();
    }
  });
  await Promise.all(workers);
}

// 英語記事を日本語化する。前回データに同じ記事があれば翻訳を再利用
async function translateArticles(articles, prevMap) {
  const tasks = [];
  for (const a of articles) {
    const prev = prevMap.get(a.id);
    if (prev?.titleOrig && prev.title) {
      // 翻訳済みキャッシュを再利用
      a.titleOrig = prev.titleOrig;
      a.title = prev.title;
      if (prev.excerptOrig !== undefined) {
        a.excerptOrig = prev.excerptOrig;
        a.excerpt = prev.excerpt;
      }
      continue;
    }
    if (JA_RE.test(a.title)) continue;
    tasks.push(async () => {
      const titleJa = await translateJa(a.title);
      if (titleJa) {
        a.titleOrig = a.title;
        a.title = titleJa;
      }
      if (a.excerpt && !JA_RE.test(a.excerpt)) {
        const exJa = await translateJa(a.excerpt);
        if (exJa) {
          a.excerptOrig = a.excerpt;
          a.excerpt = exJa;
        }
      }
    });
  }
  if (tasks.length) {
    console.log(`[fetcher] translating ${tasks.length} articles to Japanese...`);
    await runPool(tasks, 6);
  }
}

async function fetchSource(source) {
  const articles = [];
  for (const feed of source.feeds) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      console.warn(`[fetcher] feed failed: ${feed.url} (${err.message})`);
      continue;
    }
    const filterRe = feed.filter ? new RegExp(feed.filter, 'i') : null;

    for (const item of parsed.items || []) {
      let title = stripHtml(item.title || '');
      if (!title || !item.link) continue;

      let publisher = null;
      if (feed.type === 'gnews') {
        const split = splitGnewsTitle(title);
        title = split.title;
        publisher = item.gnewsSource?._ || item.gnewsSource || split.publisher;
        if (typeof publisher === 'object') publisher = null;
      }
      if (!publisher) publisher = publisherFromUrl(item.link) || source.name;

      const text = `${title} ${stripHtml(item.contentSnippet || item.content || '')}`;
      if (filterRe && !filterRe.test(text)) continue;

      const date = item.isoDate || item.pubDate || null;
      // Google Newsのsnippetはタイトルの繰り返しなので抜粋には使わない
      const excerpt = feed.type === 'gnews'
        ? ''
        : stripHtml(item.contentSnippet || item.contentEncoded || item.content || '').slice(0, EXCERPT_LEN);

      articles.push({
        id: hashId(`${source.id}|${item.link}`),
        sourceId: source.id,
        title,
        link: item.link,
        publisher,
        date,
        excerpt: excerpt && excerpt !== title ? excerpt : '',
        image: pickImage(item),
        via: feed.type === 'gnews' ? 'Google News' : 'RSS'
      });
    }
  }

  // タイトル重複を除去し、新しい順に上限まで
  const seen = new Set();
  const unique = [];
  for (const a of articles.sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0))) {
    // 「(媒体名)」等の末尾表記ゆれを除いて同一記事を判定する
    const key = a.title.toLowerCase()
      .replace(/[(（][^)）]*[)）]\s*$/g, '')
      .replace(/[\s　]+/g, ' ')
      .trim()
      .slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(a);
    if (unique.length >= MAX_PER_SOURCE) break;
  }

  // 画像がない記事は出典ページのog:imageを取得(上位数件のみ・Google Newsリダイレクトは除外)
  const targets = unique
    .filter((a) => !a.image && !a.link.includes('news.google.com'))
    .slice(0, OG_IMAGE_LOOKUPS_PER_SOURCE);
  await Promise.all(
    targets.map(async (a) => {
      a.image = await fetchOgImage(a.link);
    })
  );

  return unique;
}

export async function fetchAll() {
  console.log(`[fetcher] start ${new Date().toISOString()}`);

  // 前回データを読み込み、翻訳キャッシュとして使う
  const prevMap = new Map();
  try {
    const prev = JSON.parse(await fs.readFile(ARTICLES_PATH, 'utf8'));
    for (const a of prev.articles || []) prevMap.set(a.id, a);
  } catch { /* 初回はキャッシュなし */ }

  const results = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const list = await fetchSource(s);
        console.log(`[fetcher] ${s.id}: ${list.length} articles`);
        return list;
      } catch (err) {
        console.warn(`[fetcher] source failed: ${s.id} (${err.message})`);
        return [];
      }
    })
  );

  const all = results.flat();
  await fs.mkdir(DATA_DIR, { recursive: true });

  // フィードが全滅した場合は前回データを残す
  if (all.length === 0) {
    console.warn('[fetcher] no articles fetched; keeping previous data');
    return null;
  }

  await translateArticles(all, prevMap);

  const payload = {
    updatedAt: new Date().toISOString(),
    count: all.length,
    // フロントエンドはこのJSONだけで動くため、タブ定義(sources)も同梱する
    sources: SOURCES.map(({ feeds, ...rest }) => rest),
    articles: all
  };
  await fs.writeFile(ARTICLES_PATH, JSON.stringify(payload, null, 1), 'utf8');
  console.log(`[fetcher] done: ${all.length} articles -> data/articles.json`);
  return payload;
}

// 直接実行された場合は1回取得して終了
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fetchAll().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
