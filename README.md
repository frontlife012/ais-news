# Ai's News(アイズニュース)

AIによる、AIだけのニュースサイト(日本向け)。
大手AI各社(OpenAI / Anthropic / Google / Microsoft / Meta / xAI / Mistral / DeepSeek ほか)の
最新ニュースを自動収集し、**すべて日本語**で出典付きの記事として配信します。掲示板つき。

**公開方法は [公開手順.md](公開手順.md) を参照してください(GitHub Pages・無料)。**

## 仕組み

```
GitHub Actions(6時間ごと)
  └─ fetcher.js が各社RSS / Google Newsから記事を収集
       └─ 英語記事は日本語へ自動翻訳(翻訳済みはキャッシュ再利用)
            └─ docs/data/articles.json を更新してコミット
                 └─ GitHub Pagesが docs/ を配信 → サイトに自動反映

掲示板: Supabase(無料)に直接読み書き(docs/config.js で設定)
```

## 機能

| 機能 | 内容 |
|---|---|
| 上タブ | すべて / OpenAI(ChatGPT) / Anthropic(Claude) / Google(Gemini) / Microsoft(Copilot) / Meta(Llama) / xAI(Grok) / Mistral / DeepSeek / その他(HuggingFaceほか) |
| 日本語表示 | 日本メディアの報道は原文のまま、海外発の英語記事は**収集時に自動で日本語へ翻訳**して表示(「自動翻訳」と明示) |
| 自動更新 | GitHub Actionsが **6時間ごと** に収集・翻訳・反映。Actionsタブから手動実行も可能 |
| 記事詳細 | カードをタップするとサイト内で詳細(要約まで)を表示。「続きを読む」で出典元へ |
| 出典表示 | 全記事に出典元(媒体名)とリンクを必ず表示 |
| 画像 | 出典元のog:image / RSSの画像を使用。無い場合はブランドカラーのプレースホルダーを自動生成 |
| 掲示板 | 誰でも投稿可(ニックネーム・トピック・いいね)。NGワードフィルタ付き。データはSupabaseに保存 |

## 情報源について

- **日本メディアの報道**: Google News(日本版)経由で各社関連の日本語記事を取得
- **各社公式ブログ(一次情報)**: OpenAI / Google / DeepMind / Microsoft / Meta / Hugging Face は公式RSSから直接取得し、日本語へ自動翻訳
- ソースの追加・変更は [sources.js](sources.js) を編集してください

### X(Twitter)連携について

各社代表・開発者のX投稿の取り込みは、X APIの有料契約とX利用規約への同意が必要なため
現バージョンでは未実装です。APIキーを取得した場合は `fetcher.js` にソースを追加できます。

## リーガルチェック(著作権・利用上の注意)

- 記事は**見出しと短い抜粋(220文字以内)のみ**を表示し、全文転載は行いません(著作権法32条の引用の範囲を想定)
- すべての記事に**出典元の明記とリンク**を必須としています
- 自動翻訳した記事には「自動翻訳」と明示し、原文へのリンクを併記しています
- 画像は出典元が公開しているog:image(SNS共有用に提供されている画像)を参照表示しています
- サイト下部に削除依頼の受付文言を掲載しています。**本格的な商用運用をする場合**は、
  各メディアの利用規約の確認と弁護士によるリーガルチェックを推奨します
- 掲示板にはNGワードフィルタがありますが、公開運用時は利用規約の整備と
  通報・削除体制(プロバイダ責任制限法対応)を整えることを推奨します

## ファイル構成

```
docs/                       … 公開されるサイト本体(GitHub Pagesが配信)
  index.html / app.js / style.css
  config.js                 … 掲示板(Supabase)の接続設定
  data/articles.json        … 記事データ(Actionsが自動更新)
fetcher.js                  … 記事収集エンジン(RSS / Google News → 翻訳)
sources.js                  … ニュースソース定義(タブの追加はここ)
server.js                   … ローカル確認用サーバー(npm start)
.github/workflows/update-news.yml … 6時間ごとの自動更新ワークフロー
公開手順.md                  … 公開までの手順書
```

## ローカルでの動作確認

```
npm install
npm start
```

→ http://localhost:3456 (起動時にデータが古ければ自動で収集します)
