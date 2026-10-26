import { describe, expect, it } from 'vitest';
import { summarizeActivity, summarizeCoachTask, summarizeDay, summarizeHrv, summarizeSleep } from './summaries';

describe('summarizeSleep', () => {
  const raw = {
    calendarDate: '2026-10-21',
    sleepTimeSeconds: 25020,
    deepSleepSeconds: 3720,
    lightSleepSeconds: 15960,
    remSleepSeconds: 5340,
    awakeSleepSeconds: 1260,
    sleepStartTimestampLocal: 1792538987000,
    sleepEndTimestampLocal: 1792565267000,
    avgHeartRate: 52,
    sleepScores: { overall: { value: 83, qualifierKey: 'GOOD' } },
    sleepNeed: { actual: 450 },
  };

  it('condenses a night into readable units', () => {
    expect(summarizeSleep(raw)).toMatchObject({
      date: '2026-10-21',
      score: 83,
      rating: 'good',
      asleep: '6h57m',
      bedtime: '23:29',
      wakeTime: '06:47',
      avgHr: 52,
      minutes: { total: 417, deep: 62, light: 266, rem: 89, awake: 21, needed: 450 },
    });
  });

  it('returns null when nothing was recorded', () => {
    expect(summarizeSleep({ sleepTimeSeconds: 0 })).toBeNull();
    expect(summarizeSleep(null)).toBeNull();
  });
});

describe('summarizeHrv', () => {
  it('reports last night against the balanced range', () => {
    const summary = summarizeHrv({
      hrvSummary: {
        calendarDate: '2026-10-21',
        lastNightAvg: 87,
        weeklyAvg: 82,
        status: 'BALANCED',
        baseline: { balancedLow: 70, balancedUpper: 95 },
      },
    });
    expect(summary).toMatchObject({ lastNight: 87, weeklyAvg: 82, status: 'balanced', balancedRange: { low: 70, high: 95 } });
  });

  it('returns null without a summary', () => {
    expect(summarizeHrv({})).toBeNull();
  });
});

describe('summarizeDay', () => {
  const raw = {
    calendarDate: '2026-10-21',
    movement: { steps: { goal: 10000, value: 8421, distanceInMeters: 6400 }, floorsAscended: { value: 12.4 } },
    calories: { burnedTotal: 2400, burnedActive: 700, consumedValue: 1800, consumedGoal: 2300, consumedRemaining: 500 },
    heartRate: { minValue: 44, maxValue: 160, restingValue: 49 },
    stress: { avgLevel: 28, maxLevel: 91, qualifier: 'BALANCED' },
    bodyBattery: { minValue: 12, maxValue: 96, latestValue: 40, chargedValue: 70, drainedValue: 60 },
    intensityMinutes: { goal: 150, moderate: 20, vigorous: 15 },
    pulseOx: { avgValue: 95, minValue: 88 },
    respiration: { avgValue: 14 },
    hydration: { goalInMl: 2500, consumedInMl: 1200 },
  };

  it('flattens the nested daily summary into readable units', () => {
    expect(summarizeDay(raw)).toMatchObject({
      date: '2026-10-21',
      steps: 8421,
      stepGoal: 10000,
      distanceKm: 6.4,
      floorsClimbed: 12,
      calories: { total: 2400, active: 700, consumed: 1800, goal: 2300, remaining: 500 },
      heartRate: { resting: 49, min: 44, max: 160 },
      stress: { avg: 28, max: 91, rating: 'balanced' },
      bodyBattery: { high: 96, low: 12, now: 40 },
      spo2: { avg: 95, lowest: 88 },
      hydration: { ml: 1200, goalMl: 2500 },
    });
  });

  it('omits intake fields when no food log is linked', () => {
    const day = summarizeDay({ calendarDate: '2026-10-21', calories: { burnedTotal: 2400, burnedActive: 700 } });
    expect(day?.calories).toEqual({ total: 2400, active: 700 });
  });

  it('returns null without a date', () => {
    expect(summarizeDay({})).toBeNull();
  });
});

describe('summarizeActivity', () => {
  const run = {
    activityId: 1,
    activityName: 'Morning Run',
    activityType: { typeKey: 'running' },
    startTimeLocal: '2026-10-21 07:00:00',
    distance: 10000,
    duration: 3000,
    averageSpeed: 3.3333,
    averageHR: 150.4,
    hrTimeInZone_1: 60,
    hrTimeInZone_2: 600,
    hrTimeInZone_3: 1800,
    hrTimeInZone_4: 500,
    hrTimeInZone_5: 40,
  };

  it('reports pace for runs and time in heart-rate zones', () => {
    expect(summarizeActivity(run)).toMatchObject({
      id: 1,
      type: 'running',
      distanceKm: 10,
      duration: '50:00',
      pacePerKm: '5:00',
      avgHr: 150,
      hrZones: [
        { zone: 1, time: '1:00' },
        { zone: 2, time: '10:00' },
        { zone: 3, time: '30:00' },
        { zone: 4, time: '8:20' },
        { zone: 5, time: '0:40' },
      ],
    });
  });

  it('reports speed instead of pace for rides and skips empty zones', () => {
    const ride = summarizeActivity({ activityId: 2, activityType: { typeKey: 'cycling' }, averageSpeed: 8, distance: 20000, duration: 3600 });
    expect(ride).toMatchObject({ speedKmh: 28.8 });
    expect(ride).not.toHaveProperty('pacePerKm');
    expect(ride).not.toHaveProperty('hrZones');
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
