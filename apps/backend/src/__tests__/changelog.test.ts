import { describe, it, expect } from "vitest";
import {
  CHANGELOG,
  dayLabel,
  groupChangelogByMonth,
  latestChangelogDate,
  monthLabel,
  type ChangelogEntry,
} from "@/lib/marketing/changelog";

const entry = (date: string, title: string): ChangelogEntry => ({
  date,
  kind: "new",
  en: { title, body: "b" },
  fr: { title, body: "b" },
});

describe("changelog helpers", () => {
  it("labels months and days in both languages", () => {
    expect(monthLabel("2026-10-27")).toBe("October 2026");
    expect(monthLabel("2026-08-01", "fr")).toBe("août 2026");
    expect(dayLabel("2026-09-09")).toBe("9 September 2026");
    expect(dayLabel("2026-10-27", "fr")).toBe("27 octobre 2026");
    expect(() => monthLabel("2026-13-01")).toThrow();
  });

  it("groups newest month first, newest entry first, stable within a day", () => {
    const months = groupChangelogByMonth([
      entry("2026-08-09", "a"),
      entry("2026-10-27", "b"),
      entry("2026-10-13", "c"),
      entry("2026-10-27", "d"),
    ]);
    expect(months.map((m) => m.key)).toEqual(["2026-10", "2026-08"]);
    expect(months[0].label).toBe("October 2026");
    expect(months[0].entries.map((e) => e.en.title)).toEqual(["b", "d", "c"]);
    expect(groupChangelogByMonth([], "fr")).toEqual([]);
  });

  it("returns the newest date", () => {
    expect(latestChangelogDate([entry("2026-08-09", "a"), entry("2026-09-01", "b")])).toBe(
      "2026-09-01"
    );
    expect(latestChangelogDate()).toBe("2026-10-29");
  });
});

describe("CHANGELOG content", () => {
  it("only lists shipped changes since August 2026, with valid dates", () => {
    for (const e of CHANGELOG) {
      expect(e.date, e.en.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(e.date)), e.date).toBe(false);
      expect(e.date >= "2026-08-01", e.date).toBe(true);
      expect(e.date <= "2026-10-29", e.date).toBe(true);
    }
  });

  it("is fully translated", () => {
    for (const e of CHANGELOG) {
      for (const t of [e.en.title, e.en.body, e.fr.title, e.fr.body]) {
        expect(t.trim(), e.en.title).not.toBe("");
      }
    }
  });

  it("makes no promises and no unsold claims", () => {
    const banned =
      /coming soon|bientôt|roadmap|\bSLA\b|\bSSO\b|SOC ?2|ISO ?27001|region|région|refund|rembours|always-on|uptime/i;
    for (const e of CHANGELOG) {
      const text = [e.en.title, e.en.body, e.fr.title, e.fr.body].join(" ");
      expect(text, e.en.title).not.toMatch(banned);
    }
  });
});
