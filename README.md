# codex-review

ローカルで動く CLI + Web UI の LLM コードレビューツール（MVP スケルトン）。

## セットアップ
```
npm ci
npm run build
npm install -g .   # または npm link
codex-review --repo /path/to/repo
```

## 主要機能（実装済みの骨格）
- Fastify API (`/api/repos`, `/api/templates`, `/api/reviews`, `/api/reviews/:id/stream`)
- SQLite 永続化（better-sqlite3）
- p-queue による並列タスク実行
- simple-git で diff 取得（ワークツリー非破壊）
- Mustache テンプレートによるプロンプト生成
- SSE ストリーミングでタスク進捗通知
- CLI でサーバ起動 + ブラウザ自動オープン
- 外部 LLM はデフォルト無効（config/ENV で明示的に有効化）

## 開発メモ
- ソース: `src/` 配下、ビルド成果物: `dist/`
- 静的配信先: `web-dist/`（Vite ビルド物をここへ配置予定）。
- 設定ファイル: `~/.config/codex-review/config.json`（XDG）。
- DB: `~/.local/share/codex-review/codex-review.db`（WAL）。

## 今後の追加タスク
- React/Vite の本実装を `web/` に構築し、`web-dist` へビルド配置。
- LLM クライアントで tiktoken によるトークン計算・コスト記録を追加。
- シークレットスキャン、ファイルサンプリング制御の実装。
- BullMQ/Redis への差し替え用 QueueAdapter 実装。
