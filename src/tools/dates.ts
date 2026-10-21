import { z } from 'zod';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const MAX_RANGE_DAYS = 90;

export const dateField = z
  .string()
  .optional()
  .describe('Date as YYYY-MM-DD, "today" or "yesterday". Defaults to today.');

export const rangeFields = {
  from: z.string().optional().describe('Start date, YYYY-MM-DD. Defaults to `days` before the end date.'),
  to: z.string().optional().describe('End date, YYYY-MM-DD or "today". Defaults to today.'),
  days: z.number().int().min(1).max(MAX_RANGE_DAYS).optional().describe('Number of days ending at `to`.'),
};

export type DateRange = { from: string; to: string; dates: string[] };

export function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseUtc(value: string): number {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

function formatUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return formatUtc(parseUtc(date) + days * MS_PER_DAY);
}

export function resolveDate(input?: string): string {
  const value = input?.trim().toLowerCase();
  if (!value || value === 'today') return formatDate(new Date());
  if (value === 'yesterday') return formatDate(new Date(Date.now() - MS_PER_DAY));
  if (value === 'tomorrow') return formatDate(new Date(Date.now() + MS_PER_DAY));
  if (!DATE_PATTERN.test(value) || formatUtc(parseUtc(value)) !== value) {
    throw new Error(`Invalid date "${input}". Use YYYY-MM-DD, "today" or "yesterday".`);
  }
  return value;
}

export function resolveRange(
  input: { from?: string; to?: string; days?: number },
  defaultDays: number,
): DateRange {
  const to = resolveDate(input.to);
  const from = input.from ? resolveDate(input.from) : addDays(to, -((input.days ?? defaultDays) - 1));
  const count = (parseUtc(to) - parseUtc(from)) / MS_PER_DAY + 1;
  if (count < 1) throw new Error(`"from" (${from}) must not be after "to" (${to}).`);
  if (count > MAX_RANGE_DAYS) throw new Error(`Range is ${count} days; the maximum is ${MAX_RANGE_DAYS}.`);
  return { from, to, dates: Array.from({ length: count }, (_, i) => addDays(from, i)) };
}
