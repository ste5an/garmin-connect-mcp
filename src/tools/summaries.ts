import { clock, compact, hoursMinutes, km, label, minutes, pacePerKm, round, speedKmh, wallClock } from './format';

type Raw = Record<string, any>;

const PACE_TYPES = /running|walking|hiking/;

export function summarizeSleep(raw: Raw | null | undefined) {
  const sleep = raw?.dailySleepDTO;
  if (!sleep?.sleepTimeSeconds) return null;
  const scores = sleep.sleepScores ?? {};
  return compact({
    date: sleep.calendarDate,
    score: scores.overall?.value,
    rating: label(scores.overall?.qualifierKey),
    asleep: hoursMinutes(sleep.sleepTimeSeconds),
    minutes: {
      total: minutes(sleep.sleepTimeSeconds),
      deep: minutes(sleep.deepSleepSeconds),
      light: minutes(sleep.lightSleepSeconds),
      rem: minutes(sleep.remSleepSeconds),
      awake: minutes(sleep.awakeSleepSeconds),
      needed: (sleep.sleepNeed ?? raw?.sleepNeed)?.actual,
    },
    stagePercent: {
      deep: scores.deepPercentage && { value: scores.deepPercentage.value, rating: label(scores.deepPercentage.qualifierKey) },
      light: scores.lightPercentage && { value: scores.lightPercentage.value, rating: label(scores.lightPercentage.qualifierKey) },
      rem: scores.remPercentage && { value: scores.remPercentage.value, rating: label(scores.remPercentage.qualifierKey) },
    },
    bedtime: wallClock(sleep.sleepStartTimestampLocal),
    wakeTime: wallClock(sleep.sleepEndTimestampLocal),
    awakenings: sleep.awakeCount,
    avgHr: sleep.avgHeartRate,
    restingHr: raw?.restingHeartRate,
    overnightHrv: raw?.avgOvernightHrv,
    hrvStatus: label(raw?.hrvStatus),
    avgStress: sleep.avgSleepStress,
    bodyBatteryGain: raw?.bodyBatteryChange,
    spo2: { avg: sleep.averageSpO2Value, lowest: sleep.lowestSpO2Value },
    respiration: { avg: sleep.averageRespirationValue, lowest: sleep.lowestRespirationValue, highest: sleep.highestRespirationValue },
    skinTempDeviationC: round(raw?.avgSkinTempDeviationC, 1),
    feedback: label(sleep.sleepScoreFeedback),
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

export function summarizeDay(raw: Raw | null | undefined) {
  if (!raw?.calendarDate) return null;
  return compact({
    date: raw.calendarDate,
    steps: raw.totalSteps,
    stepGoal: raw.dailyStepGoal,
    distanceKm: km(raw.totalDistanceMeters, 1),
    floorsClimbed: round(raw.floorsAscended),
    calories: { total: raw.totalKilocalories, active: raw.activeKilocalories },
    heartRate: { resting: raw.restingHeartRate, min: raw.minHeartRate, max: raw.maxHeartRate },
    stress: { avg: raw.averageStressLevel, max: raw.maxStressLevel },
    bodyBattery: {
      atWake: raw.bodyBatteryAtWakeTime,
      high: raw.bodyBatteryHighestValue,
      low: raw.bodyBatteryLowestValue,
      now: raw.bodyBatteryMostRecentValue,
    },
    intensityMinutes: {
      moderate: raw.moderateIntensityMinutes,
      vigorous: raw.vigorousIntensityMinutes,
      goal: raw.intensityMinutesGoal,
    },
    spo2: { avg: raw.averageSpo2, lowest: raw.lowestSpo2 },
    respirationWaking: raw.avgWakingRespirationValue,
  });
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

export function summarizeLaps(raw: Raw | null | undefined) {
  const laps: Raw[] = raw?.lapDTOs ?? [];
  return laps.map((lap, index) =>
    compact({
      lap: index + 1,
      km: km(lap.distance),
      time: clock(lap.duration),
      pacePerKm: pacePerKm(lap.averageSpeed),
      avgHr: round(lap.averageHR),
      maxHr: round(lap.maxHR),
      avgPowerW: round(lap.averagePower),
      cadence: round(lap.averageRunCadence),
      elevationGainM: round(lap.elevationGain),
    }),
  );
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
