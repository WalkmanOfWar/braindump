import { describe, expect, it } from "vitest";
import { generateSessions } from "./study-planner";

describe("generateSessions", () => {
  it("generates sessions up to two days before the exam", () => {
    const sessions = generateSessions(
      new Date("2026-06-01T00:00:00Z"),
      2,
      ["Algebra", "Analiza"],
      "2026-05-26"
    );

    expect(sessions).toHaveLength(5);
    expect(sessions[0]).toEqual({ date: "2026-05-26", topic: "Algebra", hours: 2 });
    expect(sessions.at(-1)?.date).toBe("2026-05-30");
  });

  it("cycles topics in interleaved mode", () => {
    const sessions = generateSessions(
      new Date("2026-06-01T00:00:00Z"),
      1,
      ["A", "B", "C"],
      "2026-05-26",
      true
    );

    expect(sessions.map((session) => session.topic)).toEqual(["A", "B", "C", "A", "B"]);
  });

  it("returns an empty plan when there is not enough time before exam", () => {
    expect(generateSessions(new Date("2026-05-27T00:00:00Z"), 2, [], "2026-05-26")).toEqual([]);
  });
});
