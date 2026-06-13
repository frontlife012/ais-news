// ニュースソース定義(日本向け)
// feeds[].type:
//   'rss'   = 各社公式のRSS/Atomフィード(一次情報・英語が多いため取得時に自動翻訳)
//   'gnews' = Google News RSS検索。hl=ja の日本版で日本メディアの報道を取得、
//             site: 指定は公式ドメイン発の記事を拾うフォールバック
// filter: 企業の総合フィードからAI関連記事のみ抽出するためのキーワード正規表現

export const SOURCES = [
  {
    id: 'openai',
    name: 'OpenAI',
    product: 'ChatGPT',
    color: '#10a37f',
    home: 'https://openai.com/ja-JP/news/',
    feeds: [
      { type: 'rss', url: 'https://openai.com/news/rss.xml' },
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=OpenAI+OR+ChatGPT&hl=ja&gl=JP&ceid=JP:ja' }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    product: 'Claude',
    color: '#d97757',
    home: 'https://www.anthropic.com/news',
    feeds: [
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=Anthropic+OR+%22Claude%22&hl=ja&gl=JP&ceid=JP:ja' },
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=site:anthropic.com&hl=en-US&gl=US&ceid=US:en' }
    ]
  },
  {
    id: 'google',
    name: 'Google',
    product: 'Gemini',
    color: '#4285f4',
    home: 'https://blog.google/technology/ai/',
    feeds: [
      { type: 'rss', url: 'https://blog.google/technology/ai/rss/' },
      { type: 'rss', url: 'https://deepmind.google/blog/rss.xml' },
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=Google+Gemini+AI&hl=ja&gl=JP&ceid=JP:ja' }
    ]
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    product: 'Copilot',
    color: '#0078d4',
    home: 'https://news.microsoft.com/ja-jp/',
    feeds: [
      { type: 'rss', url: 'https://blogs.microsoft.com/feed/', filter: 'copilot|\\bai\\b|openai|azure ai|intelligen' },
      { type: 'rss', url: 'https://blogs.windows.com/windowsexperience/tag/copilot/feed/' },
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=Microsoft+Copilot&hl=ja&gl=JP&ceid=JP:ja' }
    ]
  },
  {
    id: 'meta',
    name: 'Meta',
    product: 'Llama',
    color: '#0866ff',
    home: 'https://ai.meta.com/blog/',
    feeds: [
      { type: 'rss', url: 'https://about.fb.com/news/feed/', filter: 'llama|\\bai\\b|meta ai|intelligen' },
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=Meta+AI+OR+Llama&hl=ja&gl=JP&ceid=JP:ja' }
    ]
  },
  {
    id: 'xai',
    name: 'xAI',
    product: 'Grok',
    color: '#1d1d1f',
    home: 'https://x.ai/news',
    feeds: [
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=xAI+OR+Grok&hl=ja&gl=JP&ceid=JP:ja' },
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=site:x.ai&hl=en-US&gl=US&ceid=US:en' }
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    product: 'Le Chat',
    color: '#fa520f',
    home: 'https://mistral.ai/news',
    feeds: [
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=%22Mistral+AI%22&hl=ja&gl=JP&ceid=JP:ja' },
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=site:mistral.ai&hl=en-US&gl=US&ceid=US:en' }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    product: 'DeepSeek',
    color: '#4d6bfe',
    home: 'https://www.deepseek.com/',
    feeds: [
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=DeepSeek&hl=ja&gl=JP&ceid=JP:ja' }
    ]
  },
  {
    id: 'others',
    name: 'その他',
    product: 'HuggingFace ほか',
    color: '#8b5cf6',
    home: 'https://huggingface.co/blog',
    feeds: [
      { type: 'rss', url: 'https://huggingface.co/blog/feed.xml' },
      // Stability AI公式RSSはXML不正でパースに失敗するためGoogle News経由で取得
      { type: 'gnews', url: 'https://news.google.com/rss/search?q=%22Stability+AI%22+OR+%22Perplexity%22+OR+%22Hugging+Face%22&hl=ja&gl=JP&ceid=JP:ja' }
    ]
  }
];
