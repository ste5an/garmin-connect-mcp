import { describe, expect, it } from 'vitest';
import { summarizeWeeks, weekStart } from './weekly';

const run = (day: string, meters: number, seconds: number) => ({
  startTimeLocal: `${day} 07:00:00`,
  activityType: { typeKey: 'running' },
  distance: meters,
  duration: seconds,
  activityTrainingLoad: 100,
});

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
  });
});

describe('summarizeWeeks', () => {
  const activities = [
    run('2026-10-12', 5000, 1500),
    run('2026-10-18', 10000, 3000),
    run('2026-10-20', 6000, 1800),
    { startTimeLocal: '2026-10-21 18:00:00', activityType: { typeKey: 'strength_training' }, duration: 3000 },
  ];
  const weeks = summarizeWeeks(activities, '2026-10-12', 2);

  it('totals runs and strength per week', () => {
    expect(weeks[0]).toMatchObject({ weekStart: '2026-10-12', runs: 2, runKm: 15, longestRunKm: 10, strengthSessions: 0 });
    expect(weeks[1]).toMatchObject({ weekStart: '2026-10-19', runs: 1, runKm: 6, strengthSessions: 1, sessions: 2 });
  });

  it('computes the share of the longest run and the change versus the previous week', () => {
    expect(weeks[0]?.longestRunShare).toBe(0.67);
    expect(weeks[1]?.runKmChangePercent).toBe(-60);
    expect(weeks[0]?.runKmChangePercent).toBeUndefined();
  });
});
