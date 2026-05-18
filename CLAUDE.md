# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンド

```bash
npm run dev        # 開発サーバー起動 (http://localhost:4321)
npm run build      # Cloudflare Pages向け静的ビルド
npm run preview    # ビルド結果のプレビュー
npm test           # Jestでテスト実行
npm run test:watch # テストのウォッチモード
```

単一テストファイルの実行:
```bash
npx jest --config jest.config.cjs src/__tests__/formatDate.test.ts
```

## アーキテクチャ

**grasshopper** は Astro で構築された日本語テックニュースブログで、Cloudflare Pages に静的デプロイされる。

### コンテンツ管理

- ブログ記事は `src/content/blog/` 以下に Markdown ファイルとして配置
- フロントマター必須フィールド: `title`, `description`, `pubDate`
- オプションフィールド: `updatedDate`, `tags`（配列）, `author`（デフォルト: `"grasshopper"`）
- コンテンツコレクションのスキーマは `src/content/config.ts` で定義

### レイアウト階層

```
BaseLayout.astro      ← HTML shell、ヘッダー・フッター・グローバルスタイル
  └── BlogPost.astro  ← 記事メタデータ表示（日付・タグ・著者）
```

### ルーティング

- `/` → `src/pages/index.astro` — pubDate 降順でブログ一覧を表示
- `/blog/[slug]/` → `src/pages/blog/[slug].astro` — `getStaticPaths` でビルド時に全記事を静的生成

### ユーティリティ

- `src/utils/formatDate.ts` — 日付フォーマット（`formatDate`: 日本語ロケール表示、`toISODateString`: `datetime` 属性用 YYYY-MM-DD）
- テストは `src/__tests__/` 以下に配置（ts-jest / Jest）

### パスエイリアス

`jest.config.cjs` で `@components/`, `@layouts/`, `@utils/` が設定済み（テスト用）。

## 運用方針

- 記事は Hermes ジョブが Discord 技術トピックをもとに毎日生成し、外部から push して運用する。
- `daily-content-generation.yml` は無効化済み（`.disabled` 拡張子）。記事生成は Hermes 側で管理。
- このリポジトリへの実装変更は Hermes/Codex が Claude Code を統制して行う。
