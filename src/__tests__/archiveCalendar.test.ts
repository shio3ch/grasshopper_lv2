import {
  buildArchiveMonths,
  buildMonthCalendar,
  formatArchiveMonthLabel,
  getArchiveDayPath,
  getArchiveMonthPath,
} from "../utils/archiveCalendar";

type TestPost = {
  slug: string;
  data: {
    pubDate: Date;
  };
};

function post(slug: string, date: string): TestPost {
  return {
    slug,
    data: {
      pubDate: new Date(`${date}T00:00:00.000Z`),
    },
  };
}

describe("archiveCalendar", () => {
  const posts = [
    post("2026/05/30/a", "2026-05-30"),
    post("2026/05/30/b", "2026-05-30"),
    post("2026/05/27/a", "2026-05-27"),
    post("2026/04/01/a", "2026-04-01"),
  ];

  it("groups posts by month with month and day counts", () => {
    expect(buildArchiveMonths(posts)).toEqual([
      {
        year: 2026,
        month: 5,
        key: "2026-05",
        count: 3,
        days: [
          { date: "2026-05-30", day: 30, count: 2 },
          { date: "2026-05-27", day: 27, count: 1 },
        ],
      },
      {
        year: 2026,
        month: 4,
        key: "2026-04",
        count: 1,
        days: [{ date: "2026-04-01", day: 1, count: 1 }],
      },
    ]);
  });

  it("builds a full month grid and marks only days that have posts", () => {
    const may = buildArchiveMonths(posts)[0];

    const cells = buildMonthCalendar(may);

    expect(cells).toHaveLength(42);
    expect(cells[0]).toMatchObject({ day: null, isCurrentMonth: false });
    expect(cells.find((cell) => cell.date === "2026-05-27")).toMatchObject({
      day: 27,
      count: 1,
      href: "/archive/2026/05/27/",
      hasPosts: true,
    });
    expect(cells.find((cell) => cell.date === "2026-05-30")).toMatchObject({
      day: 30,
      count: 2,
      href: "/archive/2026/05/30/",
      hasPosts: true,
    });
    expect(cells.find((cell) => cell.date === "2026-05-28")).toMatchObject({
      day: 28,
      count: 0,
      href: null,
      hasPosts: false,
    });
  });

  it("formats archive paths and month labels", () => {
    expect(getArchiveMonthPath(2026, 5)).toBe("/archive/2026/05/");
    expect(getArchiveDayPath("2026-05-07")).toBe("/archive/2026/05/07/");
    expect(formatArchiveMonthLabel(2026, 5)).toBe("2026年5月");
  });
});
