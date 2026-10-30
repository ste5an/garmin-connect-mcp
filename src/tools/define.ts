import type { z, ZodRawShape } from 'zod';
import type { GarminClient } from '../garmin/client';

export type ToolContext = { client: GarminClient };

export type ToolDefinition<Shape extends ZodRawShape = ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  input: Shape;
  writes?: boolean;
  destructive?: boolean;
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
