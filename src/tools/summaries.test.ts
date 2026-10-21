import { describe, expect, it } from 'vitest';
import { summarizeCoachTask, summarizeReadiness, summarizeSleep } from './summaries';

describe('summarizeSleep', () => {
  const raw = {
    restingHeartRate: 50,
    avgOvernightHrv: 87,
    hrvStatus: 'BALANCED',
    bodyBatteryChange: 51,
    dailySleepDTO: {
      calendarDate: '2026-10-21',
      sleepTimeSeconds: 25020,
      deepSleepSeconds: 3720,
      lightSleepSeconds: 15960,
      remSleepSeconds: 5340,
      awakeSleepSeconds: 1260,
      sleepStartTimestampLocal: 1792538987000,
      sleepEndTimestampLocal: 1792565267000,
      sleepScores: { overall: { value: 83, qualifierKey: 'GOOD' } },
    },
  };

  it('condenses a night into readable units', () => {
    const summary = summarizeSleep(raw);
    expect(summary).toMatchObject({
      score: 83,
      rating: 'good',
      asleep: '6h57m',
      bedtime: '23:29',
      wakeTime: '06:47',
      restingHr: 50,
      overnightHrv: 87,
      hrvStatus: 'balanced',
      minutes: { total: 417, deep: 62, light: 266, rem: 89, awake: 21 },
    });
  });

  it('returns null when nothing was recorded', () => {
    expect(summarizeSleep({ dailySleepDTO: { sleepTimeSeconds: 0 } })).toBeNull();
    expect(summarizeSleep(null)).toBeNull();
  });
});

describe('summarizeReadiness', () => {
  it('uses the latest entry of the day', () => {
    const summary = summarizeReadiness([
      { timestamp: '2026-10-21T11:21:15.0', score: 73, level: 'MODERATE', recoveryTime: 967 },
      { timestamp: '2026-10-21T12:23:44.0', score: 70, level: 'MODERATE', recoveryTime: 1189, feedbackShort: 'RECOVERY_IN_PROGRESS' },
    ]);
    expect(summary).toMatchObject({ score: 70, headline: 'recovery in progress', recoveryHours: 19.8 });
  });

  it('handles an empty day', () => {
    expect(summarizeReadiness([])).toBeNull();
  });
});

describe('summarizeCoachTask', () => {
  it('shows the interval structure and hides placeholder labels on rest days', () => {
    const tempo = summarizeCoachTask({
      calendarDate: '2026-10-22',
      keyWorkout: true,
      taskWorkout: {
        workoutName: 'Tempo',
        workoutDescription: '4x8:00@5:05/km',
        estimatedDistanceInMeters: 10957,
        estimatedDurationInSecs: 3660,
        trainingEffectLabel: 'TEMPO',
      },
    });
    expect(tempo).toMatchObject({ workout: 'Tempo', steps: '4x8:00@5:05/km', distanceKm: 11, duration: '1h01m', key: true });

    const rest = summarizeCoachTask({
      calendarDate: '2026-10-24',
      taskWorkout: { restDay: true, trainingEffectLabel: 'INVALID' },
    });
    expect(rest).toEqual({ date: '2026-10-24', workout: 'Rest' });
  });
});
