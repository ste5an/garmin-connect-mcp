import { GarminAuth, type QueryParams } from './auth';
import { LegacyAuth } from './legacy-auth';
import {
  ACTIVITIES_SEARCH_ENDPOINT,
  ADAPTIVE_TRAINING_PLAN_ENDPOINT,
  ACTIVITY_DETAILS_MAX_CHART_SIZE,
  ACTIVITY_ENDPOINT,
  BODY_BATTERY_ENDPOINT,
  CYCLING_FTP_ENDPOINT,
  DAILY_HRV_ENDPOINT,
  DAILY_HYDRATION_ENDPOINT,
  DAILY_SLEEP_ENDPOINT,
  DAILY_SLEEP_SUMMARIES_ENDPOINT,
  DAILY_STEPS_ENDPOINT,
  DAILY_STRESS_ENDPOINT,
  DAILY_SUMMARIES_ENDPOINT,
  DEFAULT_ACTIVITIES_LIMIT,
  ENDURANCE_SCORE_ENDPOINT,
  FITNESS_AGE_ENDPOINT,
  FOOD_LOGS_ENDPOINT,
  HEART_RATE_ENDPOINT,
  HEART_RATE_ZONES_ENDPOINT,
  HILL_SCORE_ENDPOINT,
  HRV_ENDPOINT,
  LACTATE_THRESHOLD_ENDPOINT,
  MENSTRUAL_DAY_VIEW_ENDPOINT,
  MENSTRUAL_SUMMARY_ENDPOINT,
  RACE_PREDICTIONS_ENDPOINT,
  SPO2_ENDPOINT,
  TRAINING_PLANS_LIST_ENDPOINT,
  TRAINING_READINESS_ENDPOINT,
  TRAINING_STATUS_ENDPOINT,
  USER_SETTINGS_ENDPOINT,
  VO2_MAX_ENDPOINT,
  WEIGHT_GOALS_ENDPOINT,
  WEIGHT_RANGE_ENDPOINT,
  WELLNESS_ACTIVITIES_ENDPOINT,
  WORKOUT_ENDPOINT,
  WORKOUT_SCHEDULE_ENDPOINT,
} from './endpoints';

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const MAX_CHUNK_DAYS = 28;
const RANGE_CONCURRENCY = 4;
const ACTIVITIES_PAGE_SIZE = 100;

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export type ActivityQuery = {
  start?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  activityType?: string;
};

export class GarminClient {
  private auth = new GarminAuth();
  private legacy: LegacyAuth;

  constructor(legacy = new LegacyAuth()) {
    this.legacy = legacy;
  }

  get hasLegacyLogin(): boolean {
    return this.legacy.isLoggedIn;
  }

  legacyLogin(): Promise<void> {
    return this.legacy.login();
  }

  connect(): Promise<void> {
    return this.auth.connect();
  }

  clearCache(): void {
    this.auth.clearCache();
  }

  get<T = unknown>(endpoint: string, params?: QueryParams): Promise<T> {
    return this.auth.get<T>(endpoint, params);
  }

  dateRange(startDate: string, endDate: string): string[] {
    if (new Date(startDate) > new Date(endDate)) {
      throw new Error(`startDate ${startDate} must not be after endDate ${endDate}`);
    }

    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]!);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  private async chunked(
    startDate: string,
    endDate: string,
    fetchChunk: (start: string, end: string) => Promise<unknown>,
  ): Promise<unknown[]> {
    if (startDate > endDate) throw new Error(`startDate ${startDate} must not be after endDate ${endDate}`);
    const results: unknown[] = [];
    for (let start = startDate; start <= endDate; start = addDays(start, MAX_CHUNK_DAYS)) {
      const end = addDays(start, MAX_CHUNK_DAYS - 1);
      const chunk = await fetchChunk(start, end < endDate ? end : endDate);
      if (Array.isArray(chunk)) results.push(...chunk);
    }
    return results;
  }

  async getActivitiesByDate(startDate: string, endDate: string, activityType?: string): Promise<unknown[]> {
    const all: unknown[] = [];
    for (let start = 0; ; start += ACTIVITIES_PAGE_SIZE) {
      const page = await this.getActivities({ start, limit: ACTIVITIES_PAGE_SIZE, startDate, endDate, activityType });
      if (!Array.isArray(page) || page.length === 0) break;
      all.push(...page);
      if (page.length < ACTIVITIES_PAGE_SIZE) break;
    }
    return all;
  }

  getActivities(query: ActivityQuery = {}): Promise<unknown> {
    const params: QueryParams = { start: query.start ?? 0, limit: query.limit ?? DEFAULT_ACTIVITIES_LIMIT };
    if (query.startDate) params.startDate = query.startDate;
    if (query.endDate) params.endDate = query.endDate;
    if (query.activityType) params.activityType = query.activityType;
    return this.get(ACTIVITIES_SEARCH_ENDPOINT, params);
  }

  getActivity(activityId: number | string): Promise<unknown> {
    return this.get(`${ACTIVITY_ENDPOINT}/${activityId}`);
  }

  getActivityDetails(activityId: number | string): Promise<unknown> {
    return this.get(`${ACTIVITY_ENDPOINT}/${activityId}/details`, { maxChartSize: ACTIVITY_DETAILS_MAX_CHART_SIZE });
  }

  getActivityWorkouts(activityId: number | string): Promise<unknown> {
    return this.get(`${ACTIVITY_ENDPOINT}/${activityId}/workouts`);
  }

  getWellnessActivities(startDate: string, endDate: string): Promise<unknown> {
    return this.get(`${WELLNESS_ACTIVITIES_ENDPOINT}/${startDate}/${endDate}`);
  }

  getDailySummaries(startDate: string, endDate: string): Promise<unknown> {
    return this.get(DAILY_SUMMARIES_ENDPOINT, { startDate, endDate });
  }

  getDailySteps(startDate: string, endDate: string): Promise<unknown[]> {
    return this.chunked(startDate, endDate, (start, end) => this.get(`${DAILY_STEPS_ENDPOINT}/${start}/${end}`));
  }

  getDailyHydration(startDate: string, endDate: string): Promise<unknown> {
    return this.get(`${DAILY_HYDRATION_ENDPOINT}/${startDate}/${endDate}`);
  }

  getDailyStress(startDate: string, endDate: string): Promise<unknown[]> {
    return this.chunked(startDate, endDate, (start, end) => this.get(`${DAILY_STRESS_ENDPOINT}/${start}/${end}`));
  }

  getHeartRate(date = todayString()): Promise<unknown> {
    return this.get(HEART_RATE_ENDPOINT, { date });
  }

  getSpO2(date = todayString()): Promise<unknown> {
    return this.get(`${SPO2_ENDPOINT}/${date}`);
  }

  getBodyBattery(startDate: string, endDate: string): Promise<unknown[]> {
    return this.chunked(startDate, endDate, (start, end) => this.get(BODY_BATTERY_ENDPOINT, { startDate: start, endDate: end }));
  }

  getSleep(date = todayString()): Promise<unknown> {
    return this.get(DAILY_SLEEP_ENDPOINT, { date });
  }

  getSleepSummaries(startDate: string, endDate: string): Promise<unknown[]> {
    return this.chunked(startDate, endDate, (start, end) =>
      this.get(DAILY_SLEEP_SUMMARIES_ENDPOINT, { startDate: start, endDate: end }),
    );
  }

  getHrv(date = todayString()): Promise<unknown> {
    return this.get(`${HRV_ENDPOINT}/${date}`);
  }

  getHrvSummaries(startDate: string, endDate: string): Promise<unknown> {
    return this.get(`${DAILY_HRV_ENDPOINT}/${startDate}/${endDate}`);
  }

  getHeartRateZones(): Promise<unknown> {
    return this.get(HEART_RATE_ZONES_ENDPOINT);
  }

  getFitnessAge(date = todayString()): Promise<unknown> {
    return this.get(`${FITNESS_AGE_ENDPOINT}/${date}`);
  }

  getWeightMeasurements(startDate: string, endDate: string): Promise<unknown> {
    return this.get(`${WEIGHT_RANGE_ENDPOINT}/${startDate}/${endDate}`, { includeAll: true });
  }

  getWeightGoals(startDate: string, endDate: string): Promise<unknown> {
    return this.get(`${WEIGHT_GOALS_ENDPOINT}/${startDate}/${endDate}`);
  }

  getFoodLogs(date = todayString()): Promise<unknown> {
    return this.get(`${FOOD_LOGS_ENDPOINT}/${date}`);
  }

  private async fetchRange(
    startDate: string,
    endDate: string,
    fetcher: (date: string) => Promise<unknown>,
  ): Promise<{ date: string; data: unknown }[]> {
    const dates = this.dateRange(startDate, endDate);
    const results: { date: string; data: unknown }[] = new Array(dates.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < dates.length) {
        const index = next++;
        const date = dates[index]!;
        results[index] = { date, data: await fetcher(date).catch(() => null) };
      }
    };
    await Promise.all(Array.from({ length: Math.min(RANGE_CONCURRENCY, dates.length) }, worker));
    return results;
  }

  getTrainingReadiness(date = todayString()): Promise<unknown> {
    return this.legacy.request(`${TRAINING_READINESS_ENDPOINT}/${date}`);
  }

  getTrainingReadinessRange(startDate: string, endDate: string): Promise<{ date: string; data: unknown }[]> {
    return this.fetchRange(startDate, endDate, (date) => this.getTrainingReadiness(date));
  }

  getTrainingStatus(date = todayString()): Promise<unknown> {
    return this.legacy.request(`${TRAINING_STATUS_ENDPOINT}/${date}`);
  }

  getVO2Max(date = todayString()): Promise<unknown> {
    return this.legacy.request(`${VO2_MAX_ENDPOINT}/${date}/${date}`);
  }

  getVO2MaxRange(startDate: string, endDate: string): Promise<{ date: string; data: unknown }[]> {
    return this.fetchRange(startDate, endDate, (date) => this.getVO2Max(date));
  }

  getEnduranceScore(startDate: string, endDate: string): Promise<unknown> {
    return this.legacy.request(`${ENDURANCE_SCORE_ENDPOINT}/stats?startDate=${startDate}&endDate=${endDate}&aggregation=weekly`);
  }

  getHillScore(startDate: string, endDate: string): Promise<unknown> {
    return this.legacy.request(`${HILL_SCORE_ENDPOINT}/stats?startDate=${startDate}&endDate=${endDate}&aggregation=daily`);
  }

  getRacePredictions(): Promise<unknown> {
    return this.legacy.request(`${RACE_PREDICTIONS_ENDPOINT}/latest/${this.legacy.displayName}`);
  }

  getLactateThreshold(): Promise<unknown> {
    return this.legacy.request(LACTATE_THRESHOLD_ENDPOINT);
  }

  getCyclingFtp(): Promise<unknown> {
    return this.legacy.request(CYCLING_FTP_ENDPOINT);
  }

  getTrainingPlans(): Promise<unknown> {
    return this.legacy.request(TRAINING_PLANS_LIST_ENDPOINT);
  }

  getAdaptiveTrainingPlan(planId: string): Promise<unknown> {
    return this.legacy.request(`${ADAPTIVE_TRAINING_PLAN_ENDPOINT}/${planId}`);
  }

  createWorkout(workout: unknown): Promise<unknown> {
    return this.legacy.request(WORKOUT_ENDPOINT, { method: 'POST', body: workout });
  }

  scheduleWorkout(workoutId: number | string, date: string): Promise<unknown> {
    return this.legacy.request(`${WORKOUT_SCHEDULE_ENDPOINT}/${workoutId}`, { method: 'POST', body: { date } });
  }

  deleteWorkout(workoutId: number | string): Promise<unknown> {
    return this.legacy.request(`${WORKOUT_ENDPOINT}/${workoutId}`, { method: 'DELETE' });
  }

  getUserSettings(): Promise<unknown> {
    return this.get(USER_SETTINGS_ENDPOINT);
  }

  getMenstrualSummary(date = todayString()): Promise<unknown> {
    return this.get(`${MENSTRUAL_SUMMARY_ENDPOINT}/${date}`);
  }

  getMenstrualDayView(date = todayString()): Promise<unknown> {
    return this.get(`${MENSTRUAL_DAY_VIEW_ENDPOINT}/${date}`, { todayDate: todayString() });
  }
}
