# tara-grant-scout

Cloudflare Workers 上で動く業務アプリの土台です。

この生成先リポジトリは starter 本体ではなく、すぐに業務機能追加へ入るための app です。

このリポジトリは core を中心に、必要な example だけを足す前提です。

- Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings
- Optional Examples: なし

## 何が入っているか

- React + TypeScript + Tailwind CSS v4
- Hono on Cloudflare Workers
- D1 + Drizzle ORM
- Zod による shared schema
- Hono RPC client による型付き API 呼び出し
- D1 session + HttpOnly Cookie 認証
- CSRF 保護
- request id
- 構造化 JSON ログ
- 統一 API エラー形式
- Durable Object ベースの auth rate limit
- organization / membership / current organization context
- password reset request / confirm flow
- email verification request / confirm flow
- Vitest ベースの自動テスト

## スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS + TanStack Query |
| Backend | Hono on Cloudflare Workers |
| Database | D1 (SQLite) + Drizzle ORM |
| Rate limit | Durable Object |
| Async jobs | Cloudflare Queues |
| Validation | Zod |
| Build | Vite + `@cloudflare/vite-plugin` |
| Testing | Vitest |

## クイックスタート

### 前提

- Node.js 20+
- npm
- Wrangler CLI

### ローカル開発

```bash
npm install
npm run db:migrate
npm run dev
```

### Cloudflare へデプロイ

```bash
# 1. リソース作成
wrangler d1 create my-app-db
wrangler queues create my-app-jobs

# 2. wrangler.jsonc の bindings / ids を更新
# 3. リモート DB へ migration 適用
npm run db:migrate:remote

# 4. デプロイ
npm run deploy
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 統合開発モード |
| `npm run dev:split` | Wrangler と Vite を分離起動 |
| `npm run build` | ビルド |
| `npm run preview` | ビルド後プレビュー |
| `npm run deploy` | Cloudflare にデプロイ |
| `npm test` | 自動テスト |
| `npm run test:watch` | テスト watch |
| `npm run db:generate` | Drizzle から migration 生成 |
| `npm run db:migrate` | ローカル D1 に migration 適用 |
| `npm run db:migrate:remote` | リモート D1 に migration 適用 |
| `npm run seed:demo` | ローカル D1 に demo user を投入 |
| `npm run doctor` | generated app としての整合性チェック |
| `npm run record:generate -- --record shared/records/xxx.ts` | Record Engine でコード生成 |

## Optional Examples

この app は core-first 構成です。optional example は含みません。

## ディレクトリ構成

```text
tara-grant-scout/
├── app/                    React UI
│   ├── hooks/              core hooks
│   └── lib/api.ts          型付き Hono RPC client
├── migrations/             core migrations
├── shared/                 フロント・バック共有契約
│   └── schemas/            core schema
├── src/                    Worker backend
│   ├── db/                 Drizzle schema
│   ├── durable-objects/    rate limiter
│   ├── lib/                auth, session, audit, organizations など
│   ├── middleware/         auth, csrf, role, request-id
│   ├── queues/             queue producer / consumer
│   ├── routes/             core API routes
│   └── index.ts            Worker entrypoint
├── scripts/                補助スクリプト
├── test/                   unit / integration tests
└── README.md
```

## Core API

| エンドポイント | 内容 |
|---|---|
| `GET /api/health` | DB / KV / R2 / Env の基本チェック |
| `GET /api/modules` | core / optional module の runtime status |
| `GET /api/orgs` | 所属 organization 一覧と current organization |
| `POST /api/orgs` | organization 作成 + current organization 切替 |
| `GET /api/orgs/current/invites` | current organization の招待一覧 |
| `POST /api/orgs/current/invites` | current organization の招待作成 |
| `POST /api/orgs/invites/accept` | organization 招待承諾 |
| `POST /api/auth/signup` | ユーザー登録 |
| `POST /api/auth/login` | ログイン |
| `POST /api/auth/logout` | ログアウト |
| `POST /api/auth/switch-org` | current organization 切替 |
| `POST /api/auth/password-reset/request` | password reset 開始 |
| `POST /api/auth/password-reset/confirm` | password reset 完了 |
| `POST /api/auth/email-verification/request` | verification mail 再送 |
| `POST /api/auth/email-verification/confirm` | email verification 完了 |
| `GET /api/auth/me` | 現在のユーザー取得 |

## Security Invariants

- session cookie は HttpOnly
- パスワードは PBKDF2 で保存
- write 系 API は CSRF 保護
- auth API は rate limit 付き
- すべてのエラーは `{ error: { code, message, requestId, details? } }`
- 監査ログは `audit_logs` に保存
- `X-Request-Id` をレスポンスとログに載せる
- organization context は `memberships` と `sessions.current_org_id` で解決

## Queue

`JOBS` Queue binding を持ち、core と optional examples の両方で job を enqueue します。

- `user.welcome`

consumer は Worker module の `queue()` handler で処理します。

organization invite 作成時には `organization.invite_email` job も enqueue されます。
password reset request 時には `auth.password_reset_email` job も enqueue されます。
signup と verification 再送時には `auth.email_verification_email` job も enqueue されます。
`EMAIL_PROVIDER=resend`、`RESEND_API_KEY`、`EMAIL_FROM` を設定すると Resend 経由で実送信します。未設定時は `log` fallback です。

## Feature Structure

`tara-grant-scout` は core と feature を分けて拡張する前提です。

- core routes: `src/routes/`
- core hooks: `app/hooks/`
- core schema: `shared/schemas/`
- example features: なし

新しい業務機能を追加する場合は、まず `core` へ入れるべき共通機能か、`example` や派生アプリ固有の feature かを分けてから配置してください。

## Optional Example APIs

この app は core-only 構成です。example feature API は含みません。

## 本番チェックリスト

- [ ] `wrangler.jsonc` の `database_id` を実値にする
- [ ] `wrangler.jsonc` の Queue binding を実値にする
- [ ] `CORS_ORIGIN` を本番 origin にする
- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる
- [ ] Durable Object migration tag を必要に応じて更新する
- [ ] Queue 名を変更した場合は producer / consumer を揃える
- [ ] auth rate limit の閾値を要件に合わせる
- [ ] `scheduled` cleanup が本番でも動くことを確認する
