/**
 * FSRS-4.5 (Free Spaced Repetition Scheduler) implementation.
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 *
 * States: 0=New, 1=Learning, 2=Review, 3=Relearning
 * Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy
 */

export type Rating = 1 | 2 | 3 | 4;

export const RATING_AGAIN = 1 as const;
export const RATING_HARD  = 2 as const;
export const RATING_GOOD  = 3 as const;
export const RATING_EASY  = 4 as const;

export const STATE_NEW        = 0 as const;
export const STATE_LEARNING   = 1 as const;
export const STATE_REVIEW     = 2 as const;
export const STATE_RELEARNING = 3 as const;

export interface FSRSCard {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  due: Date;
}

// Default FSRS-4.5 weights (w[0..16])
const W = [
  0.4072, 1.1829, 3.1262, 15.4722,  // w0-w3: init stability per rating
  7.2102, 0.5316, 1.0651,  0.6593,  // w4-w7
  1.5330, 0.1544, 1.0071,  1.9395,  // w8-w11
  0.1100, 0.2900, 2.2700,  0.0000,  // w12-w15 (w15 unused placeholder)
  2.9898,                            // w16
];

const TARGET_RETENTION = 0.9;
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ≈ 19/81

/** Initial stability for a brand-new card given the first rating. */
function initStability(rating: Rating): number {
  return Math.max(W[rating - 1], 0.1);
}

/** Initial difficulty for a brand-new card given the first rating. */
function initDifficulty(rating: Rating): number {
  return Math.min(Math.max(W[4] - Math.exp(W[5] * (rating - 1)) + 1, 1), 10);
}

/** Days until next review given current stability (targets TARGET_RETENTION). */
export function nextInterval(stability: number): number {
  const interval = (stability / FACTOR) * (Math.pow(TARGET_RETENTION, 1 / DECAY) - 1);
  return Math.max(1, Math.round(interval));
}

/** Updated stability after a successful recall (state=Review). */
function nextStability(d: number, s: number, r: number, rating: Rating): number {
  const hardPenalty = rating === RATING_HARD ? W[15] ?? 0.5 : 1;
  const easyBonus   = rating === RATING_EASY ? W[16]         : 1;
  return (
    s *
    (Math.exp(W[8]) *
      (11 - d) *
      Math.pow(s, -W[9]) *
      (Math.exp((1 - r) * W[10]) - 1) *
      hardPenalty *
      easyBonus +
      1)
  );
}

/** Updated difficulty after a review. */
function nextDifficulty(d: number, rating: Rating): number {
  const delta = W[6] * (rating - 3);
  const mean  = W[7] * initDifficulty(RATING_GOOD) + (1 - W[7]) * (d - delta);
  return Math.min(Math.max(mean, 1), 10);
}

/** Retrievability — probability of recall given elapsed days and stability. */
function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
}

/**
 * Compute the next FSRS state after a review.
 * Returns a new FSRSCard object (pure function — does not mutate input).
 */
export function scheduleCard(card: FSRSCard, rating: Rating, now: Date = new Date()): FSRSCard {
  const next = { ...card };
  const elapsed = Math.max(0, Math.round((now.getTime() - card.due.getTime()) / 86_400_000));

  next.reps += 1;

  switch (card.state) {
    case STATE_NEW: {
      next.stability  = initStability(rating);
      next.difficulty = initDifficulty(rating);
      next.elapsedDays = 0;

      if (rating === RATING_AGAIN) {
        // Stay in Learning, review again in 1 min (represented as same-day)
        next.state         = STATE_LEARNING;
        next.scheduledDays = 0;
        next.due           = new Date(now.getTime() + 60_000); // 1 minute
      } else if (rating === RATING_HARD) {
        next.state         = STATE_LEARNING;
        next.scheduledDays = 0;
        next.due           = new Date(now.getTime() + 5 * 60_000); // 5 minutes
      } else if (rating === RATING_GOOD) {
        next.state         = STATE_LEARNING;
        next.scheduledDays = 0;
        next.due           = new Date(now.getTime() + 10 * 60_000); // 10 minutes
      } else {
        // Easy — graduate directly to Review
        next.state         = STATE_REVIEW;
        next.scheduledDays = nextInterval(next.stability);
        const dueDate      = new Date(now);
        dueDate.setDate(dueDate.getDate() + next.scheduledDays);
        next.due = dueDate;
      }
      break;
    }

    case STATE_LEARNING:
    case STATE_RELEARNING: {
      if (rating === RATING_AGAIN) {
        next.state         = card.state; // stay
        next.scheduledDays = 0;
        next.due           = new Date(now.getTime() + 60_000);
      } else if (rating === RATING_HARD) {
        next.state         = card.state;
        next.scheduledDays = 0;
        next.due           = new Date(now.getTime() + 5 * 60_000);
      } else if (rating === RATING_GOOD) {
        // Graduate to Review
        next.state         = STATE_REVIEW;
        next.scheduledDays = Math.max(1, nextInterval(next.stability));
        const dueDate      = new Date(now);
        dueDate.setDate(dueDate.getDate() + next.scheduledDays);
        next.due = dueDate;
      } else {
        // Easy — graduate with bonus
        next.state         = STATE_REVIEW;
        next.scheduledDays = Math.max(1, nextInterval(next.stability) * 2);
        const dueDate      = new Date(now);
        dueDate.setDate(dueDate.getDate() + next.scheduledDays);
        next.due = dueDate;
      }
      break;
    }

    case STATE_REVIEW: {
      const r = retrievability(elapsed, card.stability);
      next.elapsedDays = elapsed;

      if (rating === RATING_AGAIN) {
        next.lapses    += 1;
        next.state      = STATE_RELEARNING;
        // Reset stability for relearning (use w[11] as "forget stability")
        next.stability  = Math.max(W[11] * Math.pow(card.difficulty, -W[12]) * (Math.pow(card.stability + 1, W[13]) - 1), 0.1);
        next.difficulty = nextDifficulty(card.difficulty, rating);
        next.scheduledDays = 0;
        next.due        = new Date(now.getTime() + 60_000);
      } else {
        next.stability  = nextStability(card.difficulty, card.stability, r, rating);
        next.difficulty = nextDifficulty(card.difficulty, rating);
        next.state      = STATE_REVIEW;
        next.scheduledDays = nextInterval(next.stability);
        const dueDate   = new Date(now);
        dueDate.setDate(dueDate.getDate() + next.scheduledDays);
        next.due = dueDate;
      }
      break;
    }
  }

  return next;
}

/** Count cards due at or before `now` (defaults to current time). */
export function getDueCount(cards: { due: Date }[], now: Date = new Date()): number {
  return cards.filter((c) => c.due <= now).length;
}

/** Human-readable label for how long until next review. */
export function formatNextInterval(scheduledDays: number): string {
  if (scheduledDays === 0) return "za chwilę";
  if (scheduledDays === 1) return "jutro";
  if (scheduledDays < 7)  return `za ${scheduledDays} dni`;
  if (scheduledDays < 30) return `za ${Math.round(scheduledDays / 7)} tyg.`;
  return `za ${Math.round(scheduledDays / 30)} mies.`;
}
