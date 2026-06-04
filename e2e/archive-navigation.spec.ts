import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type BlogPostFixture = {
  date: string;
  tags: string[];
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

function frontmatterValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function parseTags(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return Array.from(value.matchAll(/"([^"]+)"/g), (match) => match[1]);
}

function loadBlogFixtures(): BlogPostFixture[] {
  return readMarkdownFiles(contentRoot).map((filePath) => {
    const file = fs.readFileSync(filePath, "utf8");
    const frontmatter = file.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const pubDate = frontmatterValue(frontmatter, "pubDate");

    if (!pubDate) {
      throw new Error(`${filePath} does not have pubDate`);
    }

    return {
      date: pubDate.slice(0, 10),
      tags: parseTags(frontmatterValue(frontmatter, "tags")),
    };
  });
}

function formatJapaneseDate(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const posts = loadBlogFixtures();
const latestDate = posts.map((post) => post.date).sort().at(-1);

if (!latestDate) {
  throw new Error("No blog posts found for Playwright integration tests");
}

const latestDateLabel = formatJapaneseDate(latestDate);
const [latestYear, latestMonth, latestDay] = latestDate.split("-");
const latestDayPath = `/archive/${latestYear}/${latestMonth}/${latestDay}/`;
const latestMonthPath = `/archive/${latestYear}/${latestMonth}/`;
const latestMonthLabel = `${Number(latestYear)}年${Number(latestMonth)}月`;
const crossDateTag = Array.from(
  posts.reduce((tagsByName, post) => {
    for (const tag of post.tags) {
      const dates = tagsByName.get(tag) ?? new Set<string>();
      dates.add(post.date);
      tagsByName.set(tag, dates);
    }

    return tagsByName;
  }, new Map<string, Set<string>>()),
).find(([, dates]) => dates.size >= 2)?.[0];

if (!crossDateTag) {
  throw new Error("No tag with posts across multiple dates found for Playwright integration tests");
}

test.describe("トップで最新日を把握し、その日の記事一覧へ辿れる", () => {
  test("トップは最新日を見出しに出し、最新日の記事ページへ案内する", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("最新日を表示中")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: latestDateLabel })).toBeVisible();

    const dayPageLink = page.getByRole("link", { name: "この日の記事ページへ" });
    await expect(dayPageLink).toHaveAttribute("href", latestDayPath);
    await dayPageLink.click();

    await expect(page).toHaveURL(latestDayPath);
    await expect(page.getByRole("heading", { level: 1, name: latestDateLabel })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(
      posts.filter((post) => post.date === latestDate).length,
    );
  });
});

test.describe("トップの最新月カレンダーから日別ページへ移動できる", () => {
  test("最新月カレンダーの日付リンクは対応する日別アーカイブを開く", async ({ page }) => {
    await page.goto("/");

    const latestMonthCalendar = page.getByRole("region", { name: "最新月のカレンダー" });
    await expect(latestMonthCalendar.getByRole("heading", { name: latestMonthLabel })).toBeVisible();

    await latestMonthCalendar.getByRole("link", { name: new RegExp(`^${latestDate} の記事`) }).click();

    await expect(page).toHaveURL(latestDayPath);
    await expect(page.getByText("日別アーカイブ")).toBeVisible();
  });
});

test.describe("タグページで日付を跨いだ記事一覧を閲覧できる", () => {
  test("同じタグの記事を複数日ぶんまとめて確認できる", async ({ page }) => {
    await page.goto(`/tags/${encodeURI(crossDateTag)}/`);

    await expect(page.getByRole("heading", { level: 1, name: `#${crossDateTag}` })).toBeVisible();

    const dates = await page.getByRole("article").locator("time").evaluateAll((times) =>
      times.map((time) => time.getAttribute("datetime")).filter(Boolean),
    );

    expect(new Set(dates).size).toBeGreaterThanOrEqual(2);
  });
});

test.describe("日別ページから月別アーカイブと全体アーカイブへ戻れる", () => {
  test("日別ページの戻り導線から月別ページとアーカイブ全体へ移動できる", async ({ page }) => {
    await page.goto(latestDayPath);

    await page.getByRole("link", { name: `${latestMonthLabel}へ戻る` }).click();
    await expect(page).toHaveURL(latestMonthPath);
    await expect(page.getByRole("heading", { level: 1, name: latestMonthLabel })).toBeVisible();

    await page.getByRole("link", { name: "アーカイブへ戻る" }).click();
    await expect(page).toHaveURL("/archive/");
    await expect(page.getByRole("heading", { level: 1, name: "カレンダー" })).toBeVisible();
  });
});
