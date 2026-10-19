import { describe, expect, it } from "vitest";
import {
  buildIcs,
  icsFileName,
  type IcsEvent,
} from "../../client/src/lib/ics";

const NOW = new Date("2026-10-19T08:30:00.000Z");

const base: IcsEvent = {
  uid: "res-123",
  title: "Coupe",
  startAt: "2026-10-20T07:00:00.000Z",
  endAt: "2026-10-20T07:30:00.000Z",
};

/** Unfolds RFC 5545 continuation lines (CRLF followed by one space). */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

function physicalLines(ics: string): string[] {
  return ics.split("\r\n").slice(0, -1);
}

describe("buildIcs : structure", () => {
  it("produces the exact VCALENDAR/VEVENT output for a minimal event", () => {
    const expected = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FindBarber//Reservation//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:res-123@findbarber",
      "DTSTAMP:20261019T083000Z",
      "DTSTART:20261020T070000Z",
      "DTEND:20261020T073000Z",
      "SUMMARY:Coupe",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(buildIcs(base, NOW)).toBe(expected + "\r\n");
  });

  it("uses CRLF as the only line terminator", () => {
    const ics = buildIcs(base, NOW);
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
    expect(ics.replace(/\r\n/g, "").includes("\r")).toBe(false);
  });

  it("adds LOCATION and DESCRIPTION after SUMMARY when provided", () => {
    const ics = buildIcs(
      {
        ...base,
        location: "12 rue de la Paix, Paris",
        description: "Barbe incluse",
      },
      NOW,
    );
    const lines = physicalLines(ics);
    const summaryIndex = lines.indexOf("SUMMARY:Coupe");
    expect(lines[summaryIndex + 1]).toBe(
      "LOCATION:12 rue de la Paix\\, Paris",
    );
    expect(lines[summaryIndex + 2]).toBe("DESCRIPTION:Barbe incluse");
    expect(lines[summaryIndex + 3]).toBe("END:VEVENT");
  });

  it("omits LOCATION and DESCRIPTION when they are null or undefined", () => {
    const ics = buildIcs({ ...base, location: null, description: null }, NOW);
    expect(ics).not.toContain("LOCATION");
    expect(ics).not.toContain("DESCRIPTION");

    const ics2 = buildIcs(base, NOW);
    expect(ics2).not.toContain("LOCATION");
    expect(ics2).not.toContain("DESCRIPTION");
  });
});

describe("buildIcs : UTC dates", () => {
  it("formats startAt and endAt as YYYYMMDDTHHMMSSZ in UTC", () => {
    const ics = buildIcs(
      {
        ...base,
        startAt: "2026-01-05T09:05:03.000Z",
        endAt: "2026-01-05T10:00:00.000Z",
      },
      NOW,
    );
    expect(ics).toContain("DTSTART:20260105T090503Z\r\n");
    expect(ics).toContain("DTEND:20260105T100000Z\r\n");
  });

  it("converts non-UTC offsets to UTC", () => {
    const ics = buildIcs(
      {
        ...base,
        startAt: "2026-10-20T09:00:00.000+02:00",
        endAt: "2026-10-20T09:30:00.000+02:00",
      },
      NOW,
    );
    expect(ics).toContain("DTSTART:20261020T070000Z\r\n");
    expect(ics).toContain("DTEND:20261020T073000Z\r\n");
  });

  it("takes DTSTAMP from the now parameter", () => {
    const ics = buildIcs(base, new Date("2027-03-04T23:59:58.000Z"));
    expect(ics).toContain("DTSTAMP:20270304T235958Z\r\n");
  });
});

describe("buildIcs : text escaping", () => {
  it("escapes commas, semicolons, backslashes and newlines in SUMMARY", () => {
    const ics = buildIcs({ ...base, title: "a,b;c\\d\ne" }, NOW);
    expect(ics).toContain("SUMMARY:a\\,b\\;c\\\\d\\ne\r\n");
  });

  it("escapes the same characters in LOCATION and DESCRIPTION", () => {
    const ics = buildIcs(
      { ...base, location: "Rue, 1; bis", description: "ligne1\nligne2\\" },
      NOW,
    );
    expect(ics).toContain("LOCATION:Rue\\, 1\\; bis\r\n");
    expect(ics).toContain("DESCRIPTION:ligne1\\nligne2\\\\\r\n");
  });

  it("leaves accented characters unchanged", () => {
    const ics = buildIcs({ ...base, title: "Été à Ménilmontant" }, NOW);
    expect(ics).toContain("SUMMARY:Été à Ménilmontant\r\n");
  });
});

describe("buildIcs : line folding", () => {
  it("keeps every physical line at 75 octets or fewer", () => {
    const title = "Été chez Barber 💈 réservation longue ".repeat(10);
    const ics = buildIcs({ ...base, title }, NOW);
    for (const line of physicalLines(ics)) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("folds with CRLF followed by a single space and round-trips the value", () => {
    const title = "Été chez Barber 💈 réservation longue ".repeat(10);
    const ics = buildIcs({ ...base, title }, NOW);
    expect(ics).toMatch(/\r\n /);
    expect(unfold(ics)).toContain(
      "SUMMARY:" + title.replace(/\n/g, "\\n"),
    );
  });

  it("never splits a multi-byte UTF-8 character across lines", () => {
    // "SUMMARY:" is 8 bytes; 66 ASCII bytes bring the line to 74 bytes.
    // The 4-byte emoji cannot fit in the remaining byte, so it must move
    // whole to the continuation line.
    const title = "a".repeat(66) + "💈";
    const ics = buildIcs({ ...base, title }, NOW);
    const lines = physicalLines(ics);
    const first = lines.find((l) => l.startsWith("SUMMARY:"));
    expect(first).toBe("SUMMARY:" + "a".repeat(66));
    expect(lines[lines.indexOf(first!) + 1]).toBe(" 💈");
    for (const line of lines) {
      expect(line).not.toContain("�");
    }
  });

  it("does not fold lines that already fit in 75 octets", () => {
    const ics = buildIcs({ ...base, title: "Coupe" }, NOW);
    expect(ics).not.toMatch(/\r\n /);
  });
});

describe("buildIcs : validation", () => {
  it("throws when startAt is not a valid date", () => {
    expect(() => buildIcs({ ...base, startAt: "pas-une-date" }, NOW)).toThrow(
      Error,
    );
  });

  it("throws when endAt is not a valid date", () => {
    expect(() => buildIcs({ ...base, endAt: "" }, NOW)).toThrow(Error);
  });

  it("throws when endAt equals startAt", () => {
    expect(() =>
      buildIcs({ ...base, endAt: base.startAt }, NOW),
    ).toThrow(Error);
  });

  it("throws when endAt is before startAt", () => {
    expect(() =>
      buildIcs(
        {
          ...base,
          startAt: "2026-10-20T08:00:00.000Z",
          endAt: "2026-10-20T07:00:00.000Z",
        },
        NOW,
      ),
    ).toThrow(Error);
  });
});

describe("icsFileName", () => {
  it("builds a slug from the title and the UTC date", () => {
    expect(icsFileName("Rendez-vous", "2026-10-20T07:00:00.000Z")).toBe(
      "rendez-vous-2026-10-20.ics",
    );
  });

  it("produces ASCII lowercase with hyphens for accented or symbol-heavy titles", () => {
    expect(
      icsFileName("Coupe & Barbe Élégante !", "2026-10-20T07:00:00.000Z"),
    ).toBe("coupe-barbe-elegante-2026-10-20.ics");
  });

  it("falls back to rendez-vous when the title has no usable characters", () => {
    expect(icsFileName("💈 !!!", "2026-10-20T07:00:00.000Z")).toBe(
      "rendez-vous-2026-10-20.ics",
    );
  });

  it("uses the UTC calendar day, not the local one", () => {
    expect(icsFileName("Coupe", "2026-10-19T23:30:00.000Z")).toBe(
      "coupe-2026-10-19.ics",
    );
  });
});
