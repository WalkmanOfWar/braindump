import { describe, expect, it } from "vitest";
import {
  RATING_AGAIN,
  RATING_EASY,
  RATING_GOOD,
  STATE_LEARNING,
  STATE_NEW,
  STATE_REVIEW,
  formatNextInterval,
  getDueCount,
  scheduleCard,
  type FSRSCard,
} from "./fsrs";

function newCard(due = new Date("2026-05-26T10:00:00Z")): FSRSCard {
  return {
    stability: 0,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: STATE_NEW,
    due,
  };
}

describe("scheduleCard", () => {
  it("keeps a new card in learning after Again", () => {
    const now = new Date("2026-05-26T10:00:00Z");
    const scheduled = scheduleCard(newCard(now), RATING_AGAIN, now);

    expect(scheduled.state).toBe(STATE_LEARNING);
    expect(scheduled.reps).toBe(1);
    expect(scheduled.scheduledDays).toBe(0);
    expect(scheduled.due.getTime()).toBe(now.getTime() + 60_000);
  });

  it("graduates a new easy card to review", () => {
    const now = new Date("2026-05-26T10:00:00Z");
    const scheduled = scheduleCard(newCard(now), RATING_EASY, now);

    expect(scheduled.state).toBe(STATE_REVIEW);
    expect(scheduled.scheduledDays).toBeGreaterThanOrEqual(1);
    expect(scheduled.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("schedules a review card again after a successful recall", () => {
    const now = new Date("2026-05-26T10:00:00Z");
    const card: FSRSCard = {
      ...newCard(new Date("2026-05-20T10:00:00Z")),
      state: STATE_REVIEW,
      stability: 6,
      difficulty: 5,
    };

    const scheduled = scheduleCard(card, RATING_GOOD, now);

    expect(scheduled.state).toBe(STATE_REVIEW);
    expect(scheduled.elapsedDays).toBe(6);
    expect(scheduled.scheduledDays).toBeGreaterThanOrEqual(1);
    expect(scheduled.reps).toBe(1);
  });
});

describe("flashcard helpers", () => {
  it("counts cards due at or before now", () => {
    const now = new Date("2026-05-26T12:00:00Z");

    expect(
      getDueCount(
        [
          { due: new Date("2026-05-25T12:00:00Z") },
          { due: now },
          { due: new Date("2026-05-27T12:00:00Z") },
        ],
        now
      )
    ).toBe(2);
  });

  it("formats review intervals in Polish", () => {
    expect(formatNextInterval(0)).toBe("za chwilę");
    expect(formatNextInterval(1)).toBe("jutro");
    expect(formatNextInterval(5)).toBe("za 5 dni");
    expect(formatNextInterval(14)).toBe("za 2 tyg.");
    expect(formatNextInterval(60)).toBe("za 2 mies.");
  });
});
