# 浜屋 ホームページ

活魚料理・うに釜めし 浜屋（山口県長門市仙崎）の静的サイト。Cloudflare Workers（静的アセット、Worker 名 `hamaya-hp`）で公開。

- `src/` … ページのテンプレート・CSS・JS・画像
- `data/news.json` … お知らせ
- `data/menu.json` … お品書き（画像）
- `scripts/build.mjs` … `data/` を差し込んで `dist/` を生成（依存なし）

```bash
node scripts/build.mjs
```

`main` への push で、Cloudflare の Workers Builds（GitHub 連携）が
`node scripts/build.mjs` → `npx wrangler deploy` を実行して自動公開する（設定は `wrangler.jsonc`）。
DNS は Cloudflare（ネームサーバーは Xserver Domain で Cloudflare に向けている）。
`http://` と `www` は Cloudflare 側の設定で `https://hamaya-senzaki.com/` へ 301 転送。
