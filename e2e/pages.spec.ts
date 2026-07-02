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
