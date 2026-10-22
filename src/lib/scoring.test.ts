import { describe, expect, it } from "vitest";
import { gradeTone, letterGrade } from "./grading";
import { compositeScore, generateTickets, type AuditContext } from "./reports";
import { SAMPLE_ORG, SAMPLE_SCORECARD } from "./sampleData";
import { QUESTIONS, scoreAnswers } from "./scorecard";

describe("letterGrade", () => {
  it.each([
    [100, "A+"],
    [97, "A+"],
    [96, "A"],
    [90, "A"],
    [89, "B"],
    [80, "B"],
    [70, "C"],
    [60, "D"],
    [59, "F"],
    [0, "F"],
  ])("%i → %s", (score, grade) => {
    expect(letterGrade(score)).toBe(grade);
  });

  it("maps grades to tones", () => {
    expect(gradeTone("A+")).toBe("good");
    expect(gradeTone("B")).toBe("good");
    expect(gradeTone("D")).toBe("ok");
    expect(gradeTone("F")).toBe("bad");
    expect(gradeTone(null)).toBe("none");
  });
});

describe("scoreAnswers", () => {
  it("has exactly 10 questions worth 10 points each", () => {
    expect(QUESTIONS).toHaveLength(10);
    expect(scoreAnswers(Object.fromEntries(QUESTIONS.map((q) => [q.id, "yes"]))).score).toBe(100);
  });

  it("scores yes 10 / partial 4 / no 0 and lists every non-yes as a gap", () => {
    const r = scoreAnswers({ q1: "yes", q2: "partial", q3: "no" });
    expect(r.answered).toBe(3);
    expect(r.score).toBe(14);
    expect(r.gaps.map((g) => [g.q.id, g.answer])).toEqual([
      ["q2", "partial"],
      ["q3", "no"],
    ]);
  });

  it("grades the demo scorecard", () => {
    // 3 yes, 4 partial, 3 no → 30 + 16 + 0
    expect(scoreAnswers(SAMPLE_SCORECARD)).toMatchObject({ answered: 10, score: 46, grade: "F" });
  });
});

describe("compositeScore", () => {
  const ctx = (over: Partial<AuditContext>): AuditContext => ({
    org: SAMPLE_ORG,
    domain: null,
    identity: null,
    scorecard: scoreAnswers({}),
    ...over,
  });

  it("returns no grade when nothing has been assessed", () => {
    expect(compositeScore(ctx({}))).toMatchObject({ score: null, grade: null });
  });

  it("scales the MSP part by questions answered", () => {
    // 2 answered, both yes → 100%, not 20%
    expect(compositeScore(ctx({ scorecard: scoreAnswers({ q1: "yes", q2: "yes" }) })).score).toBe(100);
  });

  it("re-weights across only the modules that were run", () => {
    const domain = { score: 40, grade: "F" } as AuditContext["domain"];
    const scorecard = scoreAnswers(Object.fromEntries(QUESTIONS.map((q) => [q.id, "yes"])));
    // (40·0.30 + 100·0.35) / 0.65 = 72.3
    expect(compositeScore(ctx({ domain, scorecard }))).toMatchObject({ score: 72, grade: "C" });
  });
});

describe("generateTickets", () => {
  it("turns scorecard gaps into a governance ticket", () => {
    const tickets = generateTickets(ctx());
    const body = tickets.map((t) => JSON.stringify(t)).join("\n");
    for (const gap of scoreAnswers(SAMPLE_SCORECARD).gaps) expect(body).toContain(gap.q.title);
  });

  function ctx(): AuditContext {
    return { org: SAMPLE_ORG, domain: null, identity: null, scorecard: scoreAnswers(SAMPLE_SCORECARD) };
  }
});
