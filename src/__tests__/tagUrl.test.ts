import {
  getTagPath,
  getTagRouteParam,
  normalizeTagParam,
} from "../utils/tagUrl";

describe("getTagPath", () => {
  it("builds an encoded tag page path while preserving slash-separated tags", () => {
    expect(getTagPath("AI Agent")).toBe("/tags/AI%20Agent/");
    expect(getTagPath("日本語")).toBe("/tags/%E6%97%A5%E6%9C%AC%E8%AA%9E/");
    expect(getTagPath("CI/CD")).toBe("/tags/CI/CD/");
  });
});

describe("getTagRouteParam", () => {
  it("keeps the raw tag value for Astro static route params", () => {
    expect(getTagRouteParam("AI Agent")).toBe("AI Agent");
    expect(getTagRouteParam("日本語")).toBe("日本語");
    expect(getTagRouteParam("CI/CD")).toBe("CI/CD");
  });
});

describe("normalizeTagParam", () => {
  it("decodes a tag route parameter for filtering and display", () => {
    expect(normalizeTagParam("AI%20Agent")).toBe("AI Agent");
    expect(normalizeTagParam("%E6%97%A5%E6%9C%AC%E8%AA%9E")).toBe("日本語");
  });

  it("accepts already-decoded static route params", () => {
    expect(normalizeTagParam("AI Agent")).toBe("AI Agent");
    expect(normalizeTagParam("日本語")).toBe("日本語");
    expect(normalizeTagParam("CI/CD")).toBe("CI/CD");
  });
});
