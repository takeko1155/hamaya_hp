# 浜屋 ホームページ

活魚料理・うに釜めし 浜屋（山口県長門市仙崎）の静的サイト。GitHub Pages で公開。

- `src/` … ページのテンプレート・CSS・JS・画像
- `data/news.json` … お知らせ
- `data/menu.json` … お品書き（画像）
- `scripts/build.mjs` … `data/` を差し込んで `dist/` を生成（依存なし）

```bash
node scripts/build.mjs
```

`main` への push、手動実行、`repository_dispatch`（`content-updated`）、毎日 0:05 JST で自動デプロイ。
プレビュー中は `NOINDEX=1` で検索エンジンに載らないようにしている。
