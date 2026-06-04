import { toISODateString } from "./formatDate";

export type ArchivePostLike = {
  data: {
    pubDate: Date;
  };
};

export function sortPostsByPubDateDesc<T extends ArchivePostLike>(posts: T[]): T[] {
  return [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function getLatestArchiveDate(posts: ArchivePostLike[]): string | null {
  const [latestPost] = sortPostsByPubDateDesc(posts);
  return latestPost ? toISODateString(latestPost.data.pubDate) : null;
}

export function getPostsForArchiveDate<T extends ArchivePostLike>(posts: T[], date: string): T[] {
  return sortPostsByPubDateDesc(posts).filter((post) => toISODateString(post.data.pubDate) === date);
}

export type ArchiveDay = {
  date: string;
  day: number;
  count: number;
};

export type ArchiveMonth = {
  year: number;
  month: number;
  key: string;
  count: number;
  days: ArchiveDay[];
};

export type ArchiveCalendarCell = {
  date: string | null;
  day: number | null;
  count: number;
  href: string | null;
  hasPosts: boolean;
  isCurrentMonth: boolean;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getArchiveMonthPath(year: number, month: number): string {
  return `/archive/${year}/${pad2(month)}/`;
}

export function getArchiveDayPath(date: string): string {
  const [year, month, day] = date.split("-");
  return `/archive/${year}/${month}/${day}/`;
}

export function formatArchiveMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function buildArchiveMonths(posts: ArchivePostLike[]): ArchiveMonth[] {
  const months = new Map<string, ArchiveMonth>();

  for (const post of posts) {
    const date = toISODateString(post.data.pubDate);
    const [yearText, monthText, dayText] = date.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const key = `${yearText}-${monthText}`;

    const archiveMonth = months.get(key) ?? {
      year,
      month,
      key,
      count: 0,
      days: [],
    };

    archiveMonth.count += 1;

    const existingDay = archiveMonth.days.find((item) => item.date === date);
    if (existingDay) {
      existingDay.count += 1;
    } else {
      archiveMonth.days.push({ date, day, count: 1 });
    }

    months.set(key, archiveMonth);
  }

  return Array.from(months.values())
    .map((archiveMonth) => ({
      ...archiveMonth,
      days: archiveMonth.days.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

export function buildMonthCalendar(month: ArchiveMonth): ArchiveCalendarCell[] {
  const daysByDate = new Map(month.days.map((day) => [day.date, day]));
  const firstDate = new Date(Date.UTC(month.year, month.month - 1, 1));
  const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const leadingEmptyCells = firstDate.getUTCDay();
  const cells: ArchiveCalendarCell[] = [];

  for (let i = 0; i < leadingEmptyCells; i += 1) {
    cells.push({
      date: null,
      day: null,
      count: 0,
      href: null,
      hasPosts: false,
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month.year}-${pad2(month.month)}-${pad2(day)}`;
    const archiveDay = daysByDate.get(date);

    cells.push({
      date,
      day,
      count: archiveDay?.count ?? 0,
      href: archiveDay ? getArchiveDayPath(date) : null,
      hasPosts: Boolean(archiveDay),
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({
      date: null,
      day: null,
      count: 0,
      href: null,
      hasPosts: false,
      isCurrentMonth: false,
    });
  }

  return cells;
}
