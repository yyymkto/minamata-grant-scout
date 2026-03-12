/**
 * D1 has a limit of ~100 bound parameters per query.
 * Use this utility to batch `inArray()` queries automatically.
 *
 * @example
 * const rows = await batchInArray(ids, (batch) =>
 *   db.select().from(items).where(inArray(items.id, batch))
 * );
 */
export async function batchInArray<T>(
  ids: number[],
  fn: (batch: number[]) => Promise<T[]>,
  batchSize = 50,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const rows = await fn(batch);
    results.push(...rows);
  }
  return results;
}
