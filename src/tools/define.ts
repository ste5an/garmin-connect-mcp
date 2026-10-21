import type { z, ZodRawShape } from 'zod';
import type { GarminClient } from '../garmin/client';

export type ToolContext = { client: GarminClient };

export type ToolDefinition<Shape extends ZodRawShape = ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  input: Shape;
  mode?: 'read' | 'write' | 'destructive';
  run: (args: z.objectOutputType<Shape, z.ZodTypeAny>, context: ToolContext) => Promise<unknown>;
};

export function defineTool<Shape extends ZodRawShape>(definition: ToolDefinition<Shape>): ToolDefinition<Shape> {
  return definition;
}

type Settled<T extends Record<string, () => Promise<unknown>>> = {
  [K in keyof T]?: Awaited<ReturnType<T[K]>>;
};

export async function gather<T extends Record<string, () => Promise<unknown>>>(
  jobs: T,
): Promise<{ data: Settled<T>; unavailable: string[] }> {
  const keys = Object.keys(jobs);
  const results = await Promise.allSettled(keys.map((key) => jobs[key]!()));
  const data: Record<string, unknown> = {};
  const unavailable: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') data[keys[index]!] = result.value;
    else unavailable.push(keys[index]!);
  });
  return { data: data as Settled<T>, unavailable };
}

export async function mapConcurrent<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
