# Codex CLI Agent Guidelines (codex-review)

このプロジェクト向けの開発ガイドです（別製品の `recordingId` などの用語は排除済み）。

## Communication & Documentation
- ユーザー向け返信は日本語（要望があれば別言語）。リポジトリのテキスト/コメントは英語基調でOK。
- コミットメッセージ: 日本語 + conventional commits 準拠、ヘッダ100文字以内。
- 開発者向けエラー文は英語、UI文言は日本語。
- コメントは最小限（複雑なロジック・安全上の理由・ワークアラウンドのみ）。

## Quality Assurance
- 最低限の仕上げ手順: `pnpm run build`（バックエンド）または `pnpm run build:all`（フロント含む）。必要に応じてテストを追加実行。
- 失敗コマンドの出力は共有し、原因を解消してから完了とする。

## Security & Privacy
- すべてのコード/データは機微情報とみなし、外部LLM送信は設定で明示的に許可された場合のみ。
- シークレットはログに出さない。環境値は `.env` 等で管理し Git に含めない。
- 不明点はデフォルト拒否/確認とし、安全上の判断はコメントに残す。

## Naming Conventions
- 変数/パラメータ: lowerCamelCase（`repoId`, `taskId`, `templateId`）
- 関数: 動詞+目的語 lowerCamelCase（`fetchBranches`, `createReviewRun`）
- クラス/コンポーネント: PascalCase（`ReviewService`, `RunDashboard`）
- 定数: UPPER_SNAKE_CASE（コンパイル時）、実行時初期化は lowerCamelCase
- 外部APIスキーマは snake_case のまま型定義可／内部変数は lowerCamelCase。

## Code Style
- 2-space indent、TSはシングルクォート、JSXはダブルクォート、トレーリングカンマ推奨。
- パスは可能ならエイリアスにまとめる（未設定なら相対パスで OK）。

## TypeScript Best Practices
- `any` 禁止。必要なら `unknown` + type guard。
- 型推論を活用し、必要な箇所だけ注釈。
- 不変データは `as const` を活用。

## Service/Job Design (本プロジェクト)
- 公開メソッドは ID や明示パラメータを受け取り、暗黙状態（グローバル、ALS）に依存しない。
- Git/LLM/DB アクセスは専用モジュール経由で行い、UI/ルート層から直接触らない。
- ジョブ実行はキュー経由で行い、並列数・リトライは設定可能にする。

## Repository Structure (現状)
- `src/` : CLI/サーバ(Fastify)、ジョブ、Git・LLMクライアント、DBアクセサ等。
- `web/` : React + Vite。ビルドは `web-dist/` に出力。
- `dist/` : サーバTSのビルド成果（`pnpm run build`）。
- `web-dist/` : フロントビルド成果（`pnpm run build:web` または `build:all`）。

## Development Commands
- `pnpm run dev`       : バックエンド（ts-node-dev）
- `pnpm run dev:web`   : フロント（Vite）
- `pnpm run dev:all`   : 並行起動
- `pnpm run build` / `build:web` / `build:all`

## LLM / DB 方針
- LLM外部送信はデフォルト無効。許可時のみ API キーを使用。
- 既定DBはローカルSQLite。将来 Supabase/PostgreSQL へ移行予定（`DATABASE_URL` で切替）。
