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
    const seenBasenames = new Map<string, string>(); // basename → 最初に見たパス
    const violations: string[] = [];
    for (const post of posts) {
      const basename = path.basename(post.relativePath);
      const firstPath = seenBasenames.get(basename);
      if (firstPath) {
        violations.push(
          `${post.relativePath}: ファイル名 ${basename} が ${firstPath} と重複する`,
        );
      } else {
        seenBasenames.set(basename, post.relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  test("タイトルが重複しない", () => {
    const seenTitles = new Map<string, string>(); // title → 最初に見たパス
    const violations: string[] = [];
    for (const post of posts) {
      const title = String(post.frontmatter.title ?? "");
      const firstPath = seenTitles.get(title);
      if (firstPath) {
        violations.push(
          `${post.relativePath}: タイトル "${title}" が ${firstPath} と重複する`,
        );
      } else {
        seenTitles.set(title, post.relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
