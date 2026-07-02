# テスト充実 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hermes 生成記事の不正を CI でブロックするコンテンツ検証テスト（Jest）と、主要ページの表示を検証する E2E（Playwright）を追加する。あわせて既存の重複記事 1 本を削除する。

**Architecture:** コンテンツ検証は `src/__tests__/content.test.ts` が `src/content/blog/**/*.md` 全件を gray-matter でパースし zod スキーマで検証する。E2E は `e2e/pages.spec.ts` がコンテンツをファイルシステムから fixtures として読み、ビルド済みサイトに対して表示を検証する（既存 `e2e/archive-navigation.spec.ts` と同方式）。

**Tech Stack:** Jest (ts-jest) / Playwright / gray-matter / zod

**Spec:** `docs/superpowers/specs/2026-07-02-test-enrichment-design.md`

## Global Constraints

- ブランチ: `feat/test-enrichment`（`origin/main` 起点、作成済み）
- 既存ファイルの変更は最小限。既存テスト（`formatDate` / `tagUrl` / `archiveCalendar`、`archive-navigation.spec.ts` / `feeds.spec.ts`）は触らない
- OGP / canonical（Issue #15)は本計画の対象外
- コミットメッセージは既存の慣習（`feat:` / `fix:` / `test:` / `content:` プレフィックス、日本語本文）に従う
- テスト失敗時のメッセージには必ず違反ファイルの相対パスを含める（Hermes PR の CI 失敗原因を一目で分かるようにするため)

---

### Task 1: 重複記事の削除

**Files:**
- Delete: `src/content/blog/2026/06/28/20260628-05.md`

**Interfaces:**
- Consumes: なし
- Produces: 重複のないコンテンツツリー（Task 2 のテストは重複がない前提で書かれているわけではないが、Issue #16 の実害対応として先に整理する）

- [ ] **Step 1: 重複記事を削除する**

```bash
git rm src/content/blog/2026/06/28/20260628-05.md
```

初出の `src/content/blog/2026/06/25/20260625-10.md`（Qwen-AgentWorld の記事）は残す。

- [ ] **Step 2: 削除後に AgentWorld の記事が 1 本だけ残っていることを確認する**

Run: `grep -rl "AgentWorld" src/content/blog/`
Expected: `src/content/blog/2026/06/25/20260625-10.md` の 1 行のみ

- [ ] **Step 3: Commit**

```bash
git commit -m "content: Qwen-AgentWorld の重複記事を削除 (#16)

2026-06-25 の初出記事を残し、同一トピックの後発 (2026-06-28) を削除する。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: コンテンツ検証テスト（Jest）

**Files:**
- Modify: `package.json`（devDependencies に gray-matter / zod 追加。npm install が自動で行う）
- Create: `src/__tests__/content.test.ts`

**Interfaces:**
- Consumes: `src/content/blog/**/*.md`（frontmatter: `title`, `description`, `pubDate`, `updatedDate?`, `tags?`, `author?`）
- Produces: `npm test` で走るコンテンツ検証スイート。Task 3 は gray-matter が devDependencies に入っていることに依存する

- [ ] **Step 1: 依存を追加する**

```bash
npm install --save-dev gray-matter zod
```

Expected: `package.json` の devDependencies に `gray-matter` と `zod` が追加される

- [ ] **Step 2: コンテンツ検証テストを書く**

`src/__tests__/content.test.ts` を以下の内容で作成する:

```typescript
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

// NOTE: src/content/config.ts の blog コレクションのスキーマと同期させること
// （config.ts は astro:content に依存するため Jest から直接 import できない）
const blogSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string().min(1)).default([]),
  author: z.string().min(1).default("grasshopper"),
});

type BlogPostFile = {
  relativePath: string; // 例: 2026/06/25/20260625-10.md
  frontmatter: Record<string, unknown>;
};

const contentRoot = path.resolve(__dirname, "../content/blog");

function listMarkdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listMarkdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
  });
}

function loadPosts(): BlogPostFile[] {
  return listMarkdownFiles(contentRoot).map((filePath) => ({
    relativePath: path.relative(contentRoot, filePath).replace(/\\/g, "/"),
    frontmatter: matter(fs.readFileSync(filePath, "utf8")).data,
  }));
}

const posts = loadPosts();

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return Array.from(duplicates);
}

describe("ブログ記事のコンテンツ検証", () => {
  test("記事が 1 件以上存在する", () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  test("全記事の frontmatter がスキーマを満たす", () => {
    const violations = posts.flatMap((post) => {
      const result = blogSchema.safeParse(post.frontmatter);
      if (result.success) {
        return [];
      }

      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      return [`${post.relativePath}: ${issues}`];
    });

    expect(violations).toEqual([]);
  });

  test("ディレクトリ・ファイル名・pubDate の日付が一致する", () => {
    const violations = posts.flatMap((post) => {
      const match = post.relativePath.match(
        /^(\d{4})\/(\d{2})\/(\d{2})\/(\d{8})-\d{2}\.md$/,
      );
      if (!match) {
        return [
          `${post.relativePath}: パスが YYYY/MM/DD/YYYYMMDD-NN.md の形式ではない`,
        ];
      }

      const [, year, month, day, fileDate] = match;
      const dirDate = `${year}-${month}-${day}`;
      const issues: string[] = [];

      if (fileDate !== `${year}${month}${day}`) {
        issues.push(
          `ファイル名の日付 ${fileDate} がディレクトリ ${dirDate} と一致しない`,
        );
      }

      const parsed = blogSchema.safeParse(post.frontmatter);
      if (parsed.success) {
        const pubDate = parsed.data.pubDate.toISOString().slice(0, 10);
        if (pubDate !== dirDate) {
          issues.push(`pubDate ${pubDate} がディレクトリ ${dirDate} と一致しない`);
        }
      }

      return issues.map((issue) => `${post.relativePath}: ${issue}`);
    });

    expect(violations).toEqual([]);
  });

  test("ファイル名が重複しない", () => {
    const basenames = posts.map((post) => path.basename(post.relativePath));
    expect(findDuplicates(basenames)).toEqual([]);
  });

  test("タイトルが重複しない", () => {
    const titles = posts.map((post) => String(post.frontmatter.title ?? ""));
    expect(findDuplicates(titles)).toEqual([]);
  });
});
```

- [ ] **Step 3: テストが違反を検知できることを確認する（テストのテスト）**

意図的に不正な記事を一時作成して実行する:

```bash
mkdir -p src/content/blog/2026/01/01
cat > src/content/blog/2026/01/01/99990101-99.md <<'EOF'
---
title: ""
description: "検証用の壊れた記事"
pubDate: 2026-07-01
---

本文
EOF
npx jest --config jest.config.cjs src/__tests__/content.test.ts
```

Expected: FAIL。「全記事の frontmatter がスキーマを満たす」で `2026/01/01/99990101-99.md: title: ...`（空文字列違反）、「ディレクトリ・ファイル名・pubDate の日付が一致する」でファイル名の日付 `99990101` とディレクトリ `2026-01-01` の不一致が報告される（pubDate の整合チェックはスキーマ検証を通った記事のみ対象のため、この記事では報告されない）

- [ ] **Step 4: 一時ファイルを削除してテストが通ることを確認する**

```bash
rm src/content/blog/2026/01/01/99990101-99.md
rmdir src/content/blog/2026/01/01 src/content/blog/2026/01
npx jest --config jest.config.cjs src/__tests__/content.test.ts
```

Expected: PASS（5 テストすべて成功）

- [ ] **Step 5: 既存テストも含めて全体が通ることを確認する**

Run: `npm test`
Expected: PASS（content / formatDate / tagUrl / archiveCalendar の全スイート成功）

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/__tests__/content.test.ts
git commit -m "test: 全記事の frontmatter を検証するコンテンツテストを追加

スキーマ・パスと pubDate の整合・ファイル名とタイトルの一意性を
Jest で検証し、Hermes の記事 PR を CI でガードする (#16 の完全一致
重複の再発防止を含む)。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 主要ページ E2E（Playwright）

**Files:**
- Create: `e2e/pages.spec.ts`

**Interfaces:**
- Consumes: Task 2 で追加した `gray-matter`（fixtures のパース用）。ページの DOM: `article.post-card`（`--featured` variant、`.post-card__title-link`、`.post-card__tag`）、記事ページの `.article-header__meta time` / `.article-header__author` / `.article-header__tags`
- Produces: `npm run test:e2e` で走る主要ページスイート

- [ ] **Step 1: E2E テストを書く**

`e2e/pages.spec.ts` を以下の内容で作成する:

```typescript
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

type BlogPostFixture = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  author: string;
};

const contentRoot = path.resolve("src/content/blog");

function readMarkdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return readMarkdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
  });
}

function toISODate(value: unknown): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function loadBlogFixtures(): BlogPostFixture[] {
  return readMarkdownFiles(contentRoot).map((filePath) => {
    const { data } = matter(fs.readFileSync(filePath, "utf8"));

    return {
      slug: path
        .relative(contentRoot, filePath)
        .replace(/\\/g, "/")
        .replace(/\.md$/, ""),
      title: String(data.title),
      date: toISODate(data.pubDate),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      author: typeof data.author === "string" ? data.author : "grasshopper",
    };
  });
}

const posts = loadBlogFixtures();
const latestDate = posts.map((post) => post.date).sort().at(-1);

if (!latestDate) {
  throw new Error("No blog posts found for Playwright integration tests");
}

const latestPosts = posts.filter((post) => post.date === latestDate);

const taggedPost = posts.find((post) => post.tags.length > 0);

if (!taggedPost) {
  throw new Error("No tagged blog post found for Playwright integration tests");
}

const tagCounts = new Map<string, number>();
for (const post of posts) {
  for (const tag of post.tags) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
}
const popularTag = Array.from(tagCounts.entries()).sort(
  (a, b) => b[1] - a[1],
)[0]?.[0];

if (!popularTag) {
  throw new Error("No tag found for Playwright integration tests");
}

test.describe("トップに最新日の記事一覧が表示される", () => {
  test("記事カードが最新日の件数ぶん表示され、フィーチャー枠が 1 件ある", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("article")).toHaveCount(latestPosts.length);
    await expect(page.locator(".post-card--featured")).toHaveCount(1);
  });

  test("記事カードのタイトルリンクから記事ページへ遷移できる", async ({ page }) => {
    await page.goto("/");

    const titleLink = page.locator(".post-card--featured .post-card__title-link");
    const title = ((await titleLink.textContent()) ?? "").trim();
    await titleLink.click();

    await expect(page).toHaveURL(/\/blog\/.+\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });
});

test.describe("記事ページにメタデータが表示される", () => {
  test("タイトル・日付・著者・タグが表示される", async ({ page }) => {
    await page.goto(`/blog/${taggedPost.slug}/`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(taggedPost.title);
    await expect(page.locator(".article-header__meta time").first()).toHaveAttribute(
      "datetime",
      taggedPost.date,
    );
    await expect(page.locator(".article-header__author")).toHaveText(
      `by ${taggedPost.author}`,
    );
    for (const tag of taggedPost.tags) {
      await expect(
        page
          .locator(".article-header__tags")
          .getByRole("link", { name: `#${tag}`, exact: true }),
      ).toBeVisible();
    }
  });
});

test.describe("タグページは該当タグの記事のみを列挙する", () => {
  test("記事数が一致し、全カードがそのタグを持つ", async ({ page }) => {
    const expected = posts.filter((post) => post.tags.includes(popularTag));

    await page.goto(`/tags/${encodeURI(popularTag)}/`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`#${popularTag}`);

    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(expected.length);

    const cardTags = await cards.evaluateAll((articles) =>
      articles.map((article) =>
        Array.from(
          article.querySelectorAll(".post-card__tag"),
          (anchor) => anchor.textContent?.trim() ?? "",
        ),
      ),
    );
    for (const tags of cardTags) {
      expect(tags).toContain(`#${popularTag}`);
    }
  });
});

test.describe("存在しないページは 404 を返す", () => {
  test("未知の URL で HTTP 404 が返る", async ({ request }) => {
    const response = await request.get("/blog/no-such-post/");

    expect(response.status()).toBe(404);
  });
});
```

- [ ] **Step 2: 新規 spec だけを実行して通ることを確認する**

Run: `npm run test:e2e -- pages.spec.ts`
Expected: PASS（5 テスト成功。初回はビルド + preview 起動に 1〜2 分かかる）

失敗した場合はセレクタと実 DOM のずれを疑い、`npx playwright test pages.spec.ts --debug` ではなく、まず `dist/` の該当 HTML を直接確認して原因を特定すること。

- [ ] **Step 3: E2E 全体が通ることを確認する**

Run: `npm run test:e2e`
Expected: PASS（archive-navigation / feeds / pages の全スイート成功）

- [ ] **Step 4: Commit**

```bash
git add e2e/pages.spec.ts
git commit -m "test: 主要ページの表示を検証する E2E を追加

トップの最新日記事カード・記事ページのメタデータ・タグページの
絞り込み・404 応答を Playwright で検証する。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 全体検証

**Files:** なし（検証のみ）

**Interfaces:**
- Consumes: Task 1〜3 の成果物すべて
- Produces: マージ可能な状態の `feat/test-enrichment` ブランチ

- [ ] **Step 1: ユニットテスト全体を実行する**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: E2E 全体を実行する**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 3: ビルドが通ることを確認する**

Run: `npm run build`
Expected: 正常終了（記事削除後もビルドが壊れていないことの確認）

- [ ] **Step 4: コミット漏れがないことを確認する**

Run: `git status`
Expected: clean（`test-results/` などの生成物が出た場合はコミットしない）

完了後は superpowers:finishing-a-development-branch スキルに従って PR 作成へ進む。PR 本文では Issue #16 への部分対応（既存重複の整理・完全一致重複の再発防止）に言及する。
