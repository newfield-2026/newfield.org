# NFO Invoice MVP GitHub Pages Migration v12

GitHub Pagesを画面、Google Apps ScriptをJSON API、Googleスプレッドシートをデータ正本として使う移行スターターです。

## 重要
- 既存v11のスプレッドシート・会員・請求・PDFロジックは再利用します。
- GitHub PagesからGASへのブラウザ通信は、環境によってリダイレクト/CORSの挙動確認が必要です。まず `docs/01_CONNECTIVITY_TEST.md` を実施してください。
- GitHubには個人情報、Spreadsheet ID、Drive ID、管理者一覧を置きません。

## 最短手順
1. Google Cloud ConsoleでWeb OAuthクライアントを作成し、GitHub PagesのURLを承認済みJavaScript生成元へ登録。
2. Apps Scriptのスクリプトプロパティ `GOOGLE_WEB_CLIENT_ID` に同じクライアントIDを保存。
3. `gas/src/20_ApiAuth.gs` と `21_ApiRouter.gs` を追加し、`04_Auth.gs` と `07_WebApp.gs` を同梱版へ差し替え。
4. Webアプリを「自分として実行」「全員（Googleログイン不要でもAPI自体はトークン検証）」で新バージョン公開。APIはIDトークン＋Accountsシートで拒否します。
5. `frontend/assets/js/config.js` にGAS URLとクライアントIDを設定。
6. frontendフォルダをGitHubリポジトリへ置き、Pagesを有効化。
7. 接続テスト後、各画面を順に移植。
