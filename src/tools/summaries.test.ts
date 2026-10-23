import { describe, expect, it } from 'vitest';
import { summarizeCoachTask, summarizeDay, summarizeIntervals, summarizeReadiness, summarizeSleep } from './summaries';

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

describe('summarizeDay calories', () => {
  const base = { calendarDate: '2026-10-21', totalKilocalories: 1383, activeKilocalories: 389 };

  it('includes consumed calories when a food log is linked', () => {
    const day = summarizeDay({ ...base, includesCalorieConsumedData: true, consumedKilocalories: 481, netCalorieGoal: 1670, remainingKilocalories: 1578 });
    expect(day?.calories).toEqual({ total: 1383, active: 389, consumed: 481, goal: 1670, remaining: 1578 });
  });

  it('omits intake fields when no food log is linked', () => {
    const day = summarizeDay({ ...base, includesCalorieConsumedData: false, remainingKilocalories: 389 });
    expect(day?.calories).toEqual({ total: 1383, active: 389 });
  });
});

describe('summarizeIntervals', () => {
  const lap = (step: number, type: string, distance: number, duration: number, hr: number) => ({
    wktStepIndex: step,
    intensityType: type,
    distance,
    duration,
    averageHR: hr,
    maxHR: hr + 5,
  });

  it('merges laps of one workout step and rolls up work and recovery', () => {
    const result = summarizeIntervals({
      lapDTOs: [
        lap(0, 'WARMUP', 1000, 360, 120),
        lap(1, 'INTERVAL', 1000, 296, 160),
        lap(1, 'INTERVAL', 620, 184, 162),
        lap(2, 'RECOVERY', 300, 180, 140),
        lap(3, 'INTERVAL', 1620, 480, 165),
      ],
    });
    expect(result?.steps).toHaveLength(4);
    expect(result?.steps[1]).toMatchObject({ type: 'interval', km: 1.62, time: '8:00', pacePerKm: '4:56' });
    expect(result?.work).toMatchObject({ count: 2 });
    expect(result?.recovery).toMatchObject({ count: 1, avgHr: 140 });
  });

  it('returns nothing for a steady run without intervals', () => {
    expect(summarizeIntervals({ lapDTOs: [{ intensityType: 'ACTIVE', distance: 1000, duration: 300 }] })).toBeUndefined();
  });
});
