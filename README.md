# codex-review

ローカルで動く CLI + Web UI の LLM コードレビューツール。

## セットアップ
```
npm ci
npm run build:all
npm install -g .   # または npm link
codex-review --repo /path/to/repo
```

## 環境変数
- `ENABLE_SHELL_API=true` : シェル実行APIを有効化（デフォルト無効）。
- `REPO_SCAN_ROOT=/path/to/root` : 自動スキャン対象のルート（未指定ならサーバ起動ディレクトリ）。

## 主要APIとUI
- リポジトリ自動検出
  - `GET /api/repos/auto` : ルート直下を毎回スキャンし、`.git` を含むディレクトリを返却（`node_modules`, `.cache`, `dist`, `web-dist` 除外）。
  - `POST /api/repos/auto/refresh` : 明示的な再スキャン。
  - `REPO_SCAN_ROOT` でスキャン起点を変更可。結果には事前取得済みブランチ一覧とステータスを含む。
- リポジトリ手動追加
  - `POST /api/repos/manual` : 絶対パスで登録。既存と重複した場合は既存を返却。
  - `GET /api/repos/manual` : 登録済み一覧（ブランチキャッシュ付き）。`/api/repos` も同等レスポンス。
- ブランチ取得
  - `GET /api/repos/:id/branches` : キャッシュ済みブランチとステータスを返却。
- シェル実行（P0）
  - `GET /api/csrf` : CSRFトークンをクッキーとレスポンスで発行（SameSite=Lax）。
  - `GET /api/shell/commands` : ホワイトリスト済みコマンド一覧。`ENABLE_SHELL_API=true` 時のみ有効。
  - `POST /api/shell/run` : `commandId` を指定して非対話コマンドを実行。`x-csrf-token` ヘッダー必須、レートリミットは IP/Origin 毎に 10req/分。
  - `GET /api/shell/runs/:id/stream` : SSE で stdout/stderr/exit をリアルタイム配信（stdin は不可）。
  - ホワイトリスト: `git status`, `pnpm run build`, `pnpm run build:all`, `codex-review --help`。
- Web UI (Vite + Mantine)
  - リポジトリ一覧（自動検出 + 手動追加）、ブランチ選択、プリセットコマンド実行とストリーミングログ表示を提供。

## 開発メモ
- ソース: `src/` 配下、ビルド成果物: `dist/`
- 静的配信先: `web-dist/`（Vite ビルド物をここへ配置予定）。
- 設定ファイル: `~/.config/codex-review/config.json`（XDG）。
- DB: `~/.local/share/codex-review/codex-review.db`（WAL）。

## 運用上の注意
- シェルAPIはデフォルト無効です。必要な場合のみ `ENABLE_SHELL_API=true` を設定し、不要になったら環境変数を外して再起動してください。
- シェルAPIは標準入力を受け付けず、出力は SSE でのみ公開されます。
- 追加で許可したいコマンドは `src/services/shell-service.ts` の `allowedCommands` を編集してください（自由入力は不可）。
- サブディレクトリのリポジトリは UI から手動でパス登録する運用を想定しています。

## 今後の追加タスク
- LLM クライアントで tiktoken によるトークン計算・コスト記録を追加。
- シークレットスキャン、ファイルサンプリング制御の実装。
- BullMQ/Redis への差し替え用 QueueAdapter 実装。
