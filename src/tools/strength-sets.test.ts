import { describe, expect, it } from 'vitest';
import { poundsFromGrams, summarizeStrengthSets } from './strength-sets';

const active = (category: string, name: string | null, wktStepIndex: number | null, repetitionCount: number | null, weight: number | null, duration: number) => ({
  setType: 'ACTIVE',
  exercises: [{ category, name, probability: 99 }],
  wktStepIndex,
  repetitionCount,
  weight,
  duration,
});
const rest = { setType: 'REST', exercises: [], wktStepIndex: 1, repetitionCount: null, weight: null, duration: 120 };

describe('poundsFromGrams', () => {
  it('converts Garmin grams to pounds', () => {
    expect(poundsFromGrams(15875)).toBe(35);
    expect(poundsFromGrams(45000)).toBe(99.2);
    expect(poundsFromGrams(0)).toBeUndefined();
    expect(poundsFromGrams(null)).toBeUndefined();
  });
});

describe('summarizeStrengthSets', () => {
  it('groups working sets by exercise and skips rest', () => {
    const result = summarizeStrengthSets({
      exerciseSets: [
        active('PULL_UP', 'PULL_UP', 0, 5, 0, 97),
        rest,
        active('PULL_UP', 'PULL_UP', 0, 5, 0, 51),
        rest,
        active('BENCH_PRESS', 'SMITH_MACHINE_BENCH_PRESS', 3, 6, 45000, 40),
        active('BENCH_PRESS', 'SMITH_MACHINE_BENCH_PRESS', 3, 5, 45000, 38),
      ],
    });
    expect(result).toEqual([
      { exercise: 'pull up', sets: [{ reps: 5, seconds: 97 }, { reps: 5, seconds: 51 }], totalReps: 10 },
      { exercise: 'smith machine bench press', sets: [{ reps: 6, weightLb: 99.2, seconds: 40 }, { reps: 5, weightLb: 99.2, seconds: 38 }], totalReps: 11, topWeightLb: 99.2 },
    ]);
  });

  it('flags sets pressed through in a few seconds and leaves them out of the totals', () => {
    const [plank] = summarizeStrengthSets({
      exerciseSets: [active('PLANK', 'SIDE_PLANK', 18, null, null, 3), active('PLANK', 'SIDE_PLANK', 18, null, null, 30)],
    });
    expect(plank).toEqual({ exercise: 'side plank', sets: [{ seconds: 3, skipped: true }, { seconds: 30 }], totalReps: 0, skippedSets: 1 });
  });

  it('labels category-only and unknown exercises', () => {
    const result = summarizeStrengthSets({
      exerciseSets: [active('SHOULDER_PRESS', null, 9, 10, 20375, 30), { setType: 'ACTIVE', exercises: [], wktStepIndex: null, repetitionCount: 5, weight: null, duration: 10 }],
    });
    expect(result.map((group) => group.exercise)).toEqual(['shoulder press', 'unknown']);
    expect(result[0]!.topWeightLb).toBe(44.9);
  });

  it('handles a missing payload', () => {
    expect(summarizeStrengthSets(undefined)).toEqual([]);
  });
});
