/* Ai's News - フロントエンド(GitHub Pages版)
   ニュース: data/articles.json(GitHub Actionsが6時間ごとに更新)を読むだけ
   掲示板:   Supabase(config.jsで設定。未設定の間は「準備中」表示) */

// ---------- 状態 ----------

let sources = [];
let articles = [];
let updatedAt = null;
let activeTab = localStorage.getItem('aisnews_tab') || 'all';
let likedPosts = new Set(JSON.parse(localStorage.getItem('aisnews_liked') || '[]'));

const $ = (id) => document.getElementById(id);

const TOPIC_LABELS = {
  general: '雑談',
  review: '使った感想',
  info: '情報共有',
  question: '質問'
};

const NG_WORDS = [
  '死ね', '殺す', 'ばか', 'バカ', 'アホ', 'カス', 'クズ',
  'fuck', 'shit', 'bitch', 'asshole'
];

// ---------- Supabase(掲示板) ----------

const SB = window.AISNEWS_CONFIG || {};
const boardReady = Boolean(SB.SUPABASE_URL && SB.SUPABASE_ANON_KEY);

async function sb(path, opts = {}) {
  const res = await fetch(`${SB.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SB.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- ユーティリティ ----------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

// 画像が無い/読み込めない記事用のプレースホルダー(ブランド色グラデーションSVG)
function placeholderImg(source) {
  const color = source?.color || '#1a73e8';
  const label = source?.product || source?.name || 'AI';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 382 200">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#1c1e21"/>` +
    `</linearGradient></defs>` +
    `<rect width="382" height="200" fill="url(#g)"/>` +
    `<text x="50%" y="50%" font-family="Arial" font-size="28" font-weight="bold" fill="rgba(255,255,255,.92)" text-anchor="middle" dominant-baseline="middle">${esc(label)}</text>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), ms);
}

// ---------- タブ ----------

function sourceById(id) {
  return sources.find((s) => s.id === id);
}

function renderTabs() {
  const bar = $('tabBar');
  bar.innerHTML = '';
  const tabs = [{ id: 'all', name: 'すべて', color: '#1a73e8' }, ...sources];
  for (const s of tabs) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (activeTab === s.id ? ' active' : '');
    btn.style.setProperty('--tab-color', s.color);
    btn.innerHTML = s.id === 'all'
      ? `<span>すべて</span>`
      : `<span>${esc(s.name)}</span><small>${esc(s.product || '')}</small>`;
    btn.onclick = () => {
      activeTab = s.id;
      localStorage.setItem('aisnews_tab', activeTab);
      renderTabs();
      renderArticles();
      window.scrollTo({ top: 0 });
    };
    bar.appendChild(btn);
  }
}

// ---------- 記事 ----------

function translateUrl(link) {
  return `https://translate.google.com/translate?sl=auto&tl=ja&u=${encodeURIComponent(link)}`;
}

// 注意: <a>の入れ子はHTML仕様違反でDOMが壊れるため、
// カード本体は<article data-id>とし、クリックはイベント委譲でモーダルを開く
function cardHtml(a, hero) {
  const src = sourceById(a.sourceId) || {};
  const img = a.image || placeholderImg(src);
  const ph = placeholderImg(src);
  // 自動翻訳した記事(原文が外国語)のみ「全文を翻訳で読む」リンクを出す
  const translateLink = a.titleOrig
    ? `<a class="translate-link" href="${esc(translateUrl(a.link))}" target="_blank" rel="noopener">全文を翻訳で読む &#127760;</a>`
    : '';
  const meta =
    `<div class="card-meta">` +
    `<span class="publisher">出典: ${esc(a.publisher || src.name || '')}</span>` +
    (a.date ? `<span class="dot"></span><span>${esc(relTime(a.date))}</span>` : '') +
    (a.titleOrig ? `<span class="dot"></span><span>自動翻訳</span>` : '') +
    translateLink +
    `</div>`;
  const chip = `<div class="chip-line"><span class="source-chip" style="--chip:${esc(src.color || '#1a73e8')}">${esc(src.name || a.sourceId)}</span></div>`;

  if (hero) {
    return `<article class="card card-hero" data-id="${esc(a.id)}">
      <img class="card-img" src="${esc(img)}" loading="lazy" alt="" onerror="this.onerror=null;this.src='${ph}'">
      <div class="card-body">${chip}<div class="card-title">${esc(a.title)}</div>
      ${a.excerpt ? `<div class="card-excerpt">${esc(a.excerpt)}</div>` : ''}${meta}</div></article>`;
  }
  return `<article class="card card-row" data-id="${esc(a.id)}">
    <div class="card-body">${chip}<div class="card-title">${esc(a.title)}</div>${meta}</div>
    <img class="card-img" src="${esc(img)}" loading="lazy" alt="" onerror="this.onerror=null;this.src='${ph}'"></article>`;
}

// カードクリックで記事詳細モーダルを開く(翻訳リンク等のクリックは除く)
$('articleList').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const card = e.target.closest('.card[data-id]');
  if (!card) return;
  const article = articles.find((a) => a.id === card.dataset.id);
  if (article) openArticleModal(article);
});

// ---------- 記事詳細モーダル ----------

function openArticleModal(a) {
  const src = sourceById(a.sourceId) || {};
  const img = a.image || placeholderImg(src);
  const ph = placeholderImg(src);
  $('modalContent').innerHTML = `
    <img class="modal-img" src="${esc(img)}" alt="" onerror="this.onerror=null;this.src='${ph}'">
    <div class="modal-body">
      <div class="chip-line"><span class="source-chip" style="--chip:${esc(src.color || '#1a73e8')}">${esc(src.name || a.sourceId)}</span></div>
      <div class="modal-title">${esc(a.title)}</div>
      ${a.excerpt ? `<div class="modal-excerpt">${esc(a.excerpt)}…</div>` : ''}
      <div class="modal-note">※ここまでが要約です。全文は出典元でご覧いただけます。${a.titleOrig ? '(この記事は自動翻訳です)' : ''}</div>
      <div class="modal-meta">
        <span class="publisher">出典: ${esc(a.publisher || src.name || '')}</span>
        ${a.date ? ` ・ ${esc(relTime(a.date))}` : ''}
      </div>
      <div class="modal-actions">
        <a class="modal-btn primary" href="${esc(a.link)}" target="_blank" rel="noopener">続きを読む(出典元へ)</a>
        ${a.titleOrig ? `<a class="modal-btn secondary" href="${esc(translateUrl(a.link))}" target="_blank" rel="noopener">全文を日本語翻訳で読む</a>` : ''}
      </div>
    </div>`;
  $('articleModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeArticleModal() {
  $('articleModal').classList.add('hidden');
  document.body.style.overflow = '';
}

$('modalClose').onclick = closeArticleModal;
document.querySelector('.modal-backdrop').onclick = closeArticleModal;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeArticleModal();
});

function renderArticles() {
  const list = $('articleList');
  const empty = $('newsEmpty');
  let items = activeTab === 'all' ? articles : articles.filter((a) => a.sourceId === activeTab);
  items = items.slice().sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
  if (activeTab === 'all') items = items.slice(0, 80);

  $('updatedAt').textContent = updatedAt
    ? `最終更新: ${new Date(updatedAt).toLocaleString('ja-JP')}`
    : '';

  if (!items.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    empty.querySelector('p').textContent = articles.length
      ? 'このタブの記事はまだありません。'
      : '読み込み中…';
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = items.map((a, i) => cardHtml(a, i === 0)).join('');
}

async function loadArticles() {
  try {
    // GitHub Actionsが更新する静的JSONを読む(キャッシュ回避のためタイムスタンプ付与)
    const res = await fetch(`data/articles.json?_=${Date.now()}`);
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    articles = data.articles || [];
    sources = data.sources || [];
    updatedAt = data.updatedAt;
    renderTabs();
    renderArticles();
  } catch {
    $('newsEmpty').classList.remove('hidden');
    $('newsEmpty').querySelector('p').textContent =
      '記事データがまだありません。しばらくしてから再読み込みしてください。';
  }
}

// ---------- 掲示板 ----------

function renderPosts(posts) {
  const list = $('postList');
  const empty = $('boardEmpty');
  if (!posts.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = posts.map((p) => `
    <div class="post">
      <div class="post-head">
        <span class="post-name">${esc(p.name || '名無しさん')}</span>
        <span class="topic-chip ${esc(p.topic)}">${esc(TOPIC_LABELS[p.topic] || p.topic)}</span>
        <span>${esc(relTime(p.created_at))}</span>
      </div>
      <div class="post-body">${esc(p.body)}</div>
      <div class="post-foot">
        <button class="like-btn ${likedPosts.has(p.id) ? 'liked' : ''}" data-id="${esc(p.id)}">
          &#10084; <span>${p.likes || 0}</span>
        </button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.like-btn').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (likedPosts.has(id)) return;
      try {
        const likes = await sb('rpc/like_post', { method: 'POST', body: JSON.stringify({ post_id: id }) });
        likedPosts.add(id);
        localStorage.setItem('aisnews_liked', JSON.stringify([...likedPosts]));
        btn.classList.add('liked');
        btn.querySelector('span').textContent = likes;
      } catch { /* ignore */ }
    };
  });
}

async function loadPosts() {
  if (!boardReady) return;
  try {
    renderPosts(await sb('posts?select=*&order=created_at.desc&limit=200'));
  } catch {
    toast('掲示板の読み込みに失敗しました');
  }
}

// ---------- イベント ----------

$('refreshBtn').onclick = async () => {
  await loadArticles();
  toast('最新の情報を読み込みました');
};

function switchView(view) {
  $('newsView').classList.toggle('hidden', view !== 'news');
  $('boardView').classList.toggle('hidden', view !== 'board');
  document.body.classList.toggle('board-mode', view === 'board');
  $('navNews').classList.toggle('active', view === 'news');
  $('navBoard').classList.toggle('active', view === 'board');
  window.scrollTo({ top: 0 });
  if (view === 'board') loadPosts();
}

$('navNews').onclick = () => switchView('news');
$('navBoard').onclick = () => switchView('board');

$('postForm').onsubmit = async (e) => {
  e.preventDefault();
  const body = $('postBody').value.trim();
  const name = $('postName').value.trim();
  if (!body) return toast('本文を入力してください');
  const lower = (name + ' ' + body).toLowerCase();
  if (NG_WORDS.some((w) => lower.includes(w.toLowerCase()))) {
    return toast('投稿に不適切な表現が含まれています');
  }
  const btn = e.target.querySelector('.submit-btn');
  btn.disabled = true;
  try {
    await sb('posts', {
      method: 'POST',
      body: JSON.stringify({ name: name || null, body, topic: $('postTopic').value })
    });
    $('postBody').value = '';
    localStorage.setItem('aisnews_name', name);
    toast('投稿しました');
    await loadPosts();
  } catch {
    toast('投稿に失敗しました。時間をおいて再度お試しください');
  } finally {
    btn.disabled = false;
  }
};

// ---------- 初期化 ----------

(function init() {
  $('postName').value = localStorage.getItem('aisnews_name') || '';
  if (!boardReady) {
    // Supabase未設定の間は投稿フォームを隠して「準備中」を表示
    $('postForm').classList.add('hidden');
    $('boardSetupNote').classList.remove('hidden');
  }
  loadArticles();
})();
