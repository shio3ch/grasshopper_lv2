import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const contentRoot = path.resolve("src/content/blog");

function countMarkdownFiles(dir: string): number {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((count, entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return count + countMarkdownFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".md") ? count + 1 : count;
  }, 0);
}

const postCount = countMarkdownFiles(contentRoot);

test.describe("RSS フィードを配信する", () => {
  test("/rss.xml が全記事を含む RSS 2.0 フィードを返す", async ({ request }) => {
    const response = await request.get("/rss.xml");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");

    const body = await response.text();
    expect(body).toContain("<rss");
    expect(body).toContain("<title>grasshopper</title>");
    expect(body.match(/<item>/g)?.length ?? 0).toBe(postCount);
    expect(body).toContain("/blog/");
  });
});

test.describe("sitemap を配信する", () => {
  test("/sitemap-index.xml がサイトマップを返す", async ({ request }) => {
    const response = await request.get("/sitemap-index.xml");

    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("<sitemapindex");
    expect(body).toContain("sitemap-0.xml");
  });
});

test.describe("RSS の自動発見リンクを提供する", () => {
  test("トップページの head に alternate リンクがある", async ({ page }) => {
    await page.goto("/");

    const alternate = page.locator('link[rel="alternate"][type="application/rss+xml"]');
    await expect(alternate).toHaveAttribute("href", "/rss.xml");
  });
});
