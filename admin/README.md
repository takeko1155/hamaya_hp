# 浜屋 ホームページ管理画面（Google Apps Script）

お知らせとお品書きを、お店の方がスマホから更新するための画面。

## どこにあるか

| 項目 | 内容 |
|---|---|
| 持ち主 | 管理者の Google アカウント（GitHub の takeko1155 と同じアカウント） |
| 管理画面の URL・編集画面・ID | 公開しないため `admin/LOCAL.md`（管理者のパソコンだけ。Git 管理外）に記載 |
| コードの置き場所 | このフォルダ（`admin/`）。`clasp push` で Apps Script に送る |
| データの保存先 | GitHub `takeko1155/hamaya_hp` の `data/news.json`・`data/menu.json`・`src/assets/menu/` |
| Google ドライブ | 使わない（画像もドライブに保存しない） |

## 使える人

`Code.js` の `EDITORS` に登録したアカウントだけ（管理者・お店の2つ）。
リポジトリは公開なので、メールアドレスはハッシュ（元に戻せない値）でだけ持っている。
保存の履歴（コミット）にもメールアドレスは残らず、「お知らせを更新（お店）」のように表示される。

それ以外のアカウントで開くと「編集の権限がありません」と表示される。
初めて開くときだけ Google の許可画面が出る（「詳細」→「安全ではないページに移動」→「許可」）。
求める権限は「メールアドレスの確認」と「外部（GitHub）との通信」のみ。

## できること

- **お知らせ**：追加・変更・削除（日付はカレンダーから選択、タイトル30文字・本文300文字まで、文字のみ・URL不可）
- **お品書き**：ページの追加・1枚だけ差し替え・削除・並べ替え（↑↓）・ページ名（任意）。最大20ページ
  - 写真はスマホのブラウザで縮小してから送る（長辺1600px の JPEG）
  - 並べ替えなどは「保存する」を押すまで反映されない

保存すると GitHub にコミットされ、GitHub Actions で 1〜2分後にサイトに反映される。

## バックアップ

保存のたびに GitHub の履歴に残る。消した画像やお知らせも履歴から取り出せる
（例：`git log -- data/news.json`、削除した画像は該当コミットから復元）。

## 秘密情報

- **GITHUB_TOKEN**：Apps Script の「プロジェクトの設定 → スクリプト プロパティ」に保存。
  fine-grained トークン、対象は `hamaya_hp` のみ、権限は Contents: Read and write。
  トークン名 `hamaya-admin`、**有効期限なし（無期限）**なので更新は不要。
  漏れたと思ったら https://github.com/settings/personal-access-tokens ですぐ削除（Revoke）し、
  作り直してスクリプト プロパティを貼り替える。
- トークンはこのリポジトリやチャットには書かない。

## コードを直したとき

```bash
cd admin
clasp push
clasp update-deployment <デプロイID>   # デプロイID は admin/LOCAL.md
```

`update-deployment` で同じ URL のまま新しいコードに切り替わる（URL はお店に渡したまま変わらない）。
`admin/.clasp.json`（スクリプト ID）も公開しないため Git 管理外。別のパソコンで作業するときは
`clasp clone <スクリプトID>` で作り直す。
