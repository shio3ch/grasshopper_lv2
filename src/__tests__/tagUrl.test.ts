import { getTagPath, normalizeTagParam } from "../utils/tagUrl";

describe("getTagPath", () => {
  it("builds an encoded static tag page path", () => {
    expect(getTagPath("AI Agent")).toBe("/tags/AI%20Agent/");
    expect(getTagPath("日本語")).toBe("/tags/%E6%97%A5%E6%9C%AC%E8%AA%9E/");
  });
});

describe("normalizeTagParam", () => {
  it("decodes a tag route parameter for filtering and display", () => {
    expect(normalizeTagParam("AI%20Agent")).toBe("AI Agent");
    expect(normalizeTagParam("%E6%97%A5%E6%9C%AC%E8%AA%9E")).toBe("日本語");
  });
});
