export function round(value: number | null | undefined, digits = 0): number | undefined {
  if (value === null || value === undefined || Number.isNaN(value)) return undefined;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function compact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined) as T;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, compact(item)] as const)
      .filter(([, item]) => item !== null && item !== undefined && item !== '');
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export function clock(totalSeconds: number | null | undefined): string | undefined {
  if (totalSeconds === null || totalSeconds === undefined) return undefined;
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

export function hoursMinutes(totalSeconds: number | null | undefined): string | undefined {
  if (totalSeconds === null || totalSeconds === undefined) return undefined;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`;
}

export function kgFromGrams(grams: number | null | undefined, digits = 1): number | undefined {
  return grams ? round(grams / 1000, digits) : undefined;
}

export function minutes(seconds: number | null | undefined): number | undefined {
  return seconds === null || seconds === undefined ? undefined : Math.round(seconds / 60);
}

export function km(meters: number | null | undefined, digits = 2): number | undefined {
  return meters === null || meters === undefined ? undefined : round(meters / 1000, digits);
}

export function pacePerKm(metersPerSecond: number | null | undefined): string | undefined {
  if (!metersPerSecond || metersPerSecond <= 0) return undefined;
  return clock(1000 / metersPerSecond);
}

export function speedKmh(metersPerSecond: number | null | undefined): number | undefined {
  return metersPerSecond ? round(metersPerSecond * 3.6, 1) : undefined;
}

export function label(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return key.replace(/_\d+$/, '').toLowerCase().replace(/_/g, ' ');
}

export function wallClock(localMillis: number | null | undefined): string | undefined {
  if (localMillis === null || localMillis === undefined) return undefined;
  return new Date(localMillis).toISOString().slice(11, 16);
}

export function stats(values: (number | undefined)[]): { min: number; max: number; avg: number; latest: number } | undefined {
  const numbers = values.filter((value): value is number => typeof value === 'number');
  if (numbers.length === 0) return undefined;
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    avg: round(total / numbers.length, 1)!,
    latest: numbers[numbers.length - 1]!,
  };
}
