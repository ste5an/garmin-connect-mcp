import { clock, compact, hoursMinutes, km, label, minutes, pacePerKm, round, speedKmh, wallClock } from './format';

type Raw = Record<string, any>;

const PACE_TYPES = /running|walking|hiking/;

export function summarizeSleep(raw: Raw | null | undefined) {
  if (!raw?.sleepTimeSeconds) return null;
  const scores = raw.sleepScores ?? {};
  return compact({
    date: raw.calendarDate,
    score: scores.overall?.value,
    rating: label(scores.overall?.qualifierKey),
    asleep: hoursMinutes(raw.sleepTimeSeconds),
    minutes: {
      total: minutes(raw.sleepTimeSeconds),
      deep: minutes(raw.deepSleepSeconds),
      light: minutes(raw.lightSleepSeconds),
      rem: minutes(raw.remSleepSeconds),
      awake: minutes(raw.awakeSleepSeconds),
      needed: raw.sleepNeed?.actual,
    },
    stagePercent: {
      deep: scores.deepPercentage && { value: scores.deepPercentage.value, rating: label(scores.deepPercentage.qualifierKey) },
      light: scores.lightPercentage && { value: scores.lightPercentage.value, rating: label(scores.lightPercentage.qualifierKey) },
      rem: scores.remPercentage && { value: scores.remPercentage.value, rating: label(scores.remPercentage.qualifierKey) },
    },
    bedtime: wallClock(raw.sleepStartTimestampLocal),
    wakeTime: wallClock(raw.sleepEndTimestampLocal),
    awakenings: raw.awakeCount,
    avgHr: raw.avgHeartRate,
    avgStress: raw.avgSleepStress,
    spo2: { avg: raw.averageSpO2Value, lowest: raw.lowestSpO2Value },
    respiration: { avg: raw.averageRespirationValue, lowest: raw.lowestRespirationValue, highest: raw.highestRespirationValue },
    feedback: label(raw.sleepScoreFeedback),
  });
}

export function summarizeHrv(raw: Raw | null | undefined) {
  const summary = raw?.hrvSummary;
  if (!summary) return null;
  return compact({
    date: summary.calendarDate,
    lastNight: summary.lastNightAvg,
    weeklyAvg: summary.weeklyAvg,
    peak5Min: summary.lastNight5MinHigh,
    status: label(summary.status),
    balancedRange: summary.baseline && { low: summary.baseline.balancedLow, high: summary.baseline.balancedUpper },
  });
}

export function latestReadiness(raw: unknown): Raw | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return [...raw].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0];
}

export function summarizeReadiness(raw: unknown) {
  const entry = latestReadiness(raw);
  if (!entry) return null;
  return compact({
    date: entry.calendarDate,
    score: entry.score,
    level: label(entry.level),
    headline: label(entry.feedbackShort),
    recoveryHours: round(entry.recoveryTime / 60, 1),
    acuteLoad: entry.acuteLoad,
    hrvWeeklyAvg: entry.hrvWeeklyAverage,
    factors: {
      sleep: label(entry.sleepScoreFactorFeedback),
      sleepHistory: label(entry.sleepHistoryFactorFeedback),
      recovery: label(entry.recoveryTimeFactorFeedback),
      load: label(entry.acwrFactorFeedback),
      stress: label(entry.stressHistoryFactorFeedback),
      hrv: label(entry.hrvFactorFeedback),
    },
  });
}

export function summarizeDay(raw: Raw | null | undefined) {
  if (!raw?.calendarDate) return null;
  const { movement, calories, heartRate, stress, bodyBattery, intensityMinutes, pulseOx, respiration, hydration } = raw;
  return compact({
    date: raw.calendarDate,
    steps: movement?.steps?.value,
    stepGoal: movement?.steps?.goal,
    distanceKm: km(movement?.steps?.distanceInMeters, 1),
    floorsClimbed: round(movement?.floorsAscended?.value),
    calories: {
      total: calories?.burnedTotal,
      active: calories?.burnedActive,
      consumed: calories?.consumedValue,
      goal: calories?.consumedGoal,
      remaining: calories?.consumedRemaining,
    },
    heartRate: { resting: heartRate?.restingValue, min: heartRate?.minValue, max: heartRate?.maxValue },
    stress: { avg: stress?.avgLevel, max: stress?.maxLevel, rating: label(stress?.qualifier) },
    bodyBattery: {
      high: bodyBattery?.maxValue,
      low: bodyBattery?.minValue,
      now: bodyBattery?.latestValue,
      charged: bodyBattery?.chargedValue,
      drained: bodyBattery?.drainedValue,
    },
    intensityMinutes: { moderate: intensityMinutes?.moderate, vigorous: intensityMinutes?.vigorous, goal: intensityMinutes?.goal },
    spo2: { avg: pulseOx?.avgValue, lowest: pulseOx?.minValue },
    respiration: { avg: respiration?.avgValue, max: respiration?.maxValue, min: respiration?.minValue },
    hydration: { ml: hydration?.consumedInMl, goalMl: hydration?.goalInMl },
  });
}

const HR_ZONE_COUNT = 5;

function hrZones(raw: Raw) {
  const zones = Array.from({ length: HR_ZONE_COUNT }, (_, index) => ({
    zone: index + 1,
    time: clock(raw[`hrTimeInZone_${index + 1}`]),
  }));
  return zones.some((zone) => zone.time !== undefined && zone.time !== '0:00') ? zones : undefined;
}

export function summarizeActivity(raw: Raw) {
  const type: string = raw.activityType?.typeKey ?? '';
  const isPaced = PACE_TYPES.test(type);
  return compact({
    id: raw.activityId,
    name: raw.activityName,
    type,
    start: raw.startTimeLocal,
    distanceKm: raw.distance ? km(raw.distance) : undefined,
    duration: clock(raw.duration),
    pacePerKm: isPaced ? pacePerKm(raw.averageSpeed) : undefined,
    speedKmh: !isPaced ? speedKmh(raw.averageSpeed) : undefined,
    avgHr: round(raw.averageHR),
    maxHr: round(raw.maxHR),
    avgPowerW: round(raw.avgPower),
    elevationGainM: round(raw.elevationGain),
    calories: round(raw.calories),
    trainingEffect: { aerobic: round(raw.aerobicTrainingEffect, 1), anaerobic: round(raw.anaerobicTrainingEffect, 1) },
    effectLabel: label(raw.trainingEffectLabel),
    load: round(raw.activityTrainingLoad),
    hrZones: hrZones(raw),
    location: raw.locationName,
  });
}

export function summarizeActivityDetail(raw: Raw) {
  const summary = raw.summaryDTO ?? {};
  const type: string = raw.activityTypeDTO?.typeKey ?? '';
  const isPaced = PACE_TYPES.test(type);
  return compact({
    id: raw.activityId,
    name: raw.activityName,
    type,
    start: summary.startTimeLocal,
    location: raw.locationName,
    distanceKm: summary.distance ? km(summary.distance) : undefined,
    duration: clock(summary.duration),
    movingTime: clock(summary.movingDuration),
    pacePerKm: isPaced ? pacePerKm(summary.averageSpeed) : undefined,
    speedKmh: !isPaced ? speedKmh(summary.averageSpeed) : undefined,
    avgHr: round(summary.averageHR),
    maxHr: round(summary.maxHR),
    avgPowerW: round(summary.averagePower),
    normalizedPowerW: round(summary.normalizedPower),
    cadence: round(summary.averageRunCadence),
    strideLengthM: summary.strideLength ? round(summary.strideLength / 100, 2) : undefined,
    groundContactMs: round(summary.groundContactTime),
    verticalOscillationCm: round(summary.verticalOscillation, 1),
    elevationGainM: round(summary.elevationGain),
    elevationLossM: round(summary.elevationLoss),
    calories: round(summary.calories),
    trainingEffect: {
      aerobic: round(summary.trainingEffect, 1),
      anaerobic: round(summary.anaerobicTrainingEffect, 1),
      message: label(summary.aerobicTrainingEffectMessage),
    },
    load: round(summary.activityTrainingLoad),
    bodyBatteryChange: summary.differenceBodyBattery,
    steps: summary.steps,
    workoutFeel: summary.directWorkoutFeel,
    workoutRpe: summary.directWorkoutRpe,
  });
}

export function summarizeCoachTask(task: Raw) {
  const workout = task.taskWorkout ?? {};
  return compact({
    date: task.calendarDate,
    workout: workout.restDay ? 'Rest' : workout.workoutName,
    steps: workout.workoutDescription,
    distanceKm: km(workout.estimatedDistanceInMeters, 1),
    duration: hoursMinutes(workout.estimatedDurationInSecs),
    purpose: workout.trainingEffectLabel === 'INVALID' ? undefined : label(workout.trainingEffectLabel),
    key: task.keyWorkout || undefined,
    status: label(workout.adaptiveCoachingWorkoutStatus),
    note: label(workout.workoutPhrase),
  });
}

export function summarizeTrainingStatus(raw: Raw | null | undefined) {
  if (!raw) return null;
  const status = Object.values<Raw>(raw.mostRecentTrainingStatus?.latestTrainingStatusData ?? {})[0];
  const balance = Object.values<Raw>(raw.mostRecentTrainingLoadBalance?.metricsTrainingLoadBalanceDTOMap ?? {})[0];
  const load = status?.acuteTrainingLoadDTO;
  return compact({
    status: label(status?.trainingStatusFeedbackPhrase),
    since: status?.sinceDate,
    vo2Max: raw.mostRecentVO2Max?.generic?.vo2MaxPreciseValue,
    load: load && {
      acute: load.dailyTrainingLoadAcute,
      chronic: load.dailyTrainingLoadChronic,
      ratio: round(load.dailyAcuteChronicWorkloadRatio, 2),
      ratioStatus: label(load.acwrStatus),
      optimalChronicRange: [round(load.minTrainingLoadChronic), round(load.maxTrainingLoadChronic)],
    },
    loadBalance: balance && {
      feedback: label(balance.trainingBalanceFeedbackPhrase),
      aerobicLow: { value: round(balance.monthlyLoadAerobicLow), target: [balance.monthlyLoadAerobicLowTargetMin, balance.monthlyLoadAerobicLowTargetMax] },
      aerobicHigh: { value: round(balance.monthlyLoadAerobicHigh), target: [balance.monthlyLoadAerobicHighTargetMin, balance.monthlyLoadAerobicHighTargetMax] },
      anaerobic: { value: round(balance.monthlyLoadAnaerobic), target: [balance.monthlyLoadAnaerobicTargetMin, balance.monthlyLoadAnaerobicTargetMax] },
    },
  });
}
