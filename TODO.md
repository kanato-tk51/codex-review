# TODO (codex-review)

> ゴール: ローカルCLI+Web UIで、複数テンプレのLLMレビューを安全かつ快適に回せる状態へ。優先度順に記載。

## P0: 動作安定・安全
- [ ] 外部LLM送信ガード
  - UIに「外部送信を許可」トグルとAPIキー入力欄を追加（config保存）。
  - バックエンドで config.allowExternalSend=false の場合はLLM呼び出しを即ブロックし、理由を返す。
- [ ] シークレット検知
  - 送信前に diff/patch を正規表現スキャン（AWS_KEY/GCP_KEY/PRIVATE KEY/RSA/ghp_ 等）。ヒット時はタスクを error にして SSE 通知。
  - ヒット一覧をレスポンスに含め、ユーザ承諾後に送る「強制送信モード」は当面なし。
- [ ] ポート・権限問題の緩和
  - CLIのデフォルトポートを環境変数で上書き可能にし、`--port 0` 時は割り当てポートをログに出す。
  - .config/.data パスを必ずワークスペース配下に統一 (CONFIG_DIR / DATA_DIR)、ENVで上書き可能にする。
- [ ] エラーハンドリングの明示
  - API全体に try/catch を入れ、標準化エラーレスポンス `{error, detail?}`。
  - ログレベル切替 (env LOG_LEVEL=info|debug)。

## P1: ジョブ・キューの堅牢化
- [ ] QueueAdapter 抽象化
  - `p-queue` 実装をラップする interface を作り、BullMQ へ差し替え可能に。
  - 並列数/待ち行列サイズを API/設定で変更できるようにする。
- [ ] タスク再試行とキャンセル
  - タスク失敗時のリトライ回数/間隔設定。
  - フロントから「キャンセル」「再実行」を叩けるAPIを追加。
- [ ] 永続キュー (M2以降)
  - Redis + BullMQ 導入手順を docs に記載。ローカルではデフォルト無効。

## P1: LLMクライアント強化
- [ ] トークン見積り＆トリミング
  - tiktoken 等で prompt tokens を概算し、maxTokens を超えないよう diff/patch を切り詰める。
  - diffファイルのサイズ上限/件数上限/拡張子フィルタをオプション化し、テンプレ実行時に適用。
- [ ] モデル選択 UI/設定
  - テンプレ既定モデル + 実行時オーバーライドを UI から指定。
- [ ] コスト/使用量ログ
  - usage(prompt_tokens, completion_tokens) を DB に記録し、UI の Run/Task 詳細で表示。
- [ ] リトライ/バックオフ
  - 429/5xx 時に指数バックオフ3回、可変。

## P1: Git/入力データ制御
- [ ] 差分フィルタリング
  - maxFiles, maxPatchBytes, 拡張子 allowlist/denylist を設定化。
  - 大容量ファイルはスキップし、スキップ理由を結果に明示。
- [ ] 依存ファイル抜粋
  - package.json / pnpm-lock / requirements.txt / go.mod などを自動抽出し、テンプレに渡す optional コンテキストとして組み込む。

## P1: フロントエンド基礎実装
- [ ] 画面構成
  - Home: リポ一覧/追加、最近の実行。
  - RepoDetail: base/target branch 選択、テンプレ複数選択、オプション（並列数/maxFiles/maxTokens/外部送信トグル）を指定して実行。
  - Runs Dashboard: 実行中/完了のカードとステータス。
  - Task Detail: ストリーミング結果のMarkdown表示、エラー表示、コピー/Issue出力ボタン。
  - Template Manager: CRUD + インポート/エクスポート(JSON)。
- [ ] データ取得
  - React Query で `/api/repos`, `/api/templates`, `/api/reviews` をフェッチ。
  - SSE hook (`/api/reviews/:id/stream`) で進捗更新。
- [ ] UX
  - モデル/並列度/送信上限スライダのフォームバリデーション。
  - ローディング/エラー/空状態コンポーネント。

## P2: 設定・ストレージ
- [ ] 設定画面
  - APIキー、allowExternalSend、defaultModel、parallelism、maxFiles/maxTokens、データ/ログパス表示・コピー。
- [ ] ログ/DBのメンテ
  - 「ログ削除」「DBパージ」ボタン（確認ダイアログ付）。
- [ ] **DB移行（Supabase/PostgreSQL）準備**
  - 接続設定: `DATABASE_URL`（Postgres形式）をサポートし、未指定時はSQLiteフォールバックにする。
  - DBゲートウェイ層: 現在の better-sqlite3 直呼びを薄いリポジトリ層に置き換え、SQLはそこに集約。
  - マイグレーションツール導入（例: knex/drizzle/umzug）。既存DDLを移植し、SQLite/Postgres両対応のスキーマにする。
  - Supabase接続テスト: ローカル `.env` に `DATABASE_URL` を設定して CRUD・トランザクションの簡易テスト。
  - 認証/権限: Supabase 側の行レベルセキュリティ（RLS）はローカル用途ではオフ、将来マルチユーザ化を見据えた設計メモを残す。
  - コスト/レイテンシ対策: コネクションプール設定（pg-pool）、タイムアウト・リトライの共通化。
  - データ移行手順書: SQLite から Postgres への export/import 手順（例: sqlite3 .dump → psql / またはスクリプト）を docs に追加。

## P2: レポート出力/連携
- [ ] GitHub Issue/PR 用テンプレ生成（ワンクリックでクリップボード）。
- [ ] 結果エクスポート: JSON/Markdown。

## P2: テスト/CI
- [ ] Unit: git-utils, prompt-builder, template-store, review-service（モックLLM）。
- [ ] Integration: Fastify サーバを supertest で叩く。
- [ ] E2E (任意): Playwright + モックLLMでUIフロー確認。
- [ ] CI: lint/test、(任意) web build のみ実行。

## P3: スケール/配布
- [ ] npm pack / GitHub Release スクリプト。
- [ ] Homebrew formula or npm global install ドキュメント。
- [ ] BullMQ/Redis 本番モード手順を README に追記。

## 既知の改善メモ
- [ ] favicon 404 対応（スタティックに置く）。
- [ ] SSEの切断時再接続ロジックをフロントに実装。
- [ ] ログ出力フォーマット (pino) の設定（timestamp/level/json toggle）。
