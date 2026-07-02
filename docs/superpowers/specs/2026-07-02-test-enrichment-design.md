# テスト充実 設計書（2026-07-02）

## 背景・目的

このリポジトリの変更の大半は、Hermes ジョブが毎日 push するブログ記事（現在 282 本）である。
`content-ci.yml` は `src/**` を触る PR で `npm test` / E2E / build を実行し、`content-auto-merge.yml`
がコンテンツ PR を自動マージする。つまり **Jest にコンテンツ検証を追加すれば、不正な記事の
自動マージを CI が直接ブロックできる**。

現状のテストは以下のみで、コンテンツとページ表示の検証が欠けている。

- ユニット (Jest): `formatDate` / `tagUrl` / `archiveCalendar`（`src/utils/` は全カバー済み）
- E2E (Playwright): アーカイブナビゲーション、RSS / sitemap 配信

## スコープ

**PR①（本設計の対象）**

1. 既存重複記事の整理（Issue #16 の実害対応）
2. コンテンツ検証テスト（Jest）
3. 主要ページ E2E（Playwright)

**PR②（対象外・別 PR）**: Issue #15 の OGP / canonical / `twitter:card` 実装と、その SEO E2E。
本設計には含めない。

## 1. 既存重複記事の整理

Qwen-AgentWorld のほぼ同内容の記事が 2 本ある（Issue #16 記載の実害）。

- 残す: `src/content/blog/2026/06/25/20260625-10.md`（初出）
- 削除: `src/content/blog/2026/06/28/20260628-05.md`（既出トピックの後発重複）

補足: この 2 本はタイトルが完全一致ではない（言い換え）。したがって後述のタイトル重複テスト
では捕捉できない種類の重複であり、意味的な重複の防止は Hermes 側の冪等性対応
（Issue #16 対応案 1）に委ねる。本テスト導入時点で完全一致のタイトル重複はゼロであることを
確認済み。

## 2. コンテンツ検証テスト（Jest）

`src/__tests__/content.test.ts` を新設し、`src/content/blog/**/*.md` 全件を検証する。

### 検証項目

| # | 項目 | 内容 |
|---|------|------|
| a | frontmatter スキーマ | `title` / `description` が非空文字列、`pubDate` が有効な日付、`tags` は文字列配列（省略可）、`updatedDate` は有効な日付（省略可）、`author` は文字列（省略可） |
| b | パスと日付の整合 | ディレクトリ `YYYY/MM/DD` とファイル名 `YYYYMMDD-NN.md` と `pubDate` の日付が一致する |
| c | ファイル名の一意性 | basename がツリー全体で重複しない |
| d | タイトルの一意性 | `title` の完全一致重複がない |

### 実装方針

- frontmatter のパースに `gray-matter` を devDependency として追加する
  （既存 E2E の正規表現パースより堅牢。E2E 側の書き換えは本 PR ではしない）
- スキーマ検証には `zod` を devDependency として追加し、テスト内で定義する。
  `src/content/config.ts` は `astro:content` に依存するため Jest から直接 import できない。
  スキーマの二重定義になる点はテスト内コメントで `config.ts` との同期を明示する
- 違反時のエラーメッセージに **対象ファイルパスと違反内容** を含め、Hermes の PR が CI で
  落ちたとき原因が一目で分かるようにする

## 3. 主要ページ E2E（Playwright）

`e2e/pages.spec.ts` を新設する。fixtures は既存 `archive-navigation.spec.ts` と同様に
`src/content/blog` をファイルシステムから読んで動的に導出する。

| ページ | 検証内容 |
|--------|----------|
| トップ `/` | 記事一覧が pubDate 降順で表示される。記事リンクから記事ページへ遷移できる |
| 記事 `/blog/[slug]/` | タイトル・日付・タグ・著者が表示される |
| タグ `/tags/[tag]/` | 該当タグを持つ記事のみが列挙される |
| 404 | 存在しない URL が 404 を返す |

## テスト実行・CI

- `npm test` / `npm run test:e2e` で実行。`content-ci.yml` の変更は不要
- 将来 Issue #34（記事のみの PR で E2E を省略）が入っても、Jest のコンテンツ検証は
  残る前提なのでガードは維持される

## ブランチ / PR

- `origin/main` から `feat/test-enrichment` を作成して PR① とする
- PR 本文で Issue #16（部分対応: 既存重複の整理と完全一致重複の再発防止）に言及する
