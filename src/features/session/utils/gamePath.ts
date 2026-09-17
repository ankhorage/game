import type { GameRecord, GameValue } from '../../../types/game';

/*** Read one dot-separated value path from a serializable game value. */
export function readGamePath(value: GameValue | undefined, path?: string): GameValue | undefined {
  if (path === undefined || path.length === 0) return value;
  return path.split('.').reduce<GameValue | undefined>((current, segment) => {
    if (current === undefined || current === null) return undefined;
    if (isGameArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current.at(index) : undefined;
    }
    if (typeof current !== 'object') return undefined;
    return readRecordEntry(current, segment);
  }, value);
}

/*** Immutably write one dot-separated object path in game state. */
export function writeGamePath(root: GameRecord, path: string, value: GameValue): GameRecord {
  const segments = path.split('.').filter((segment) => segment.length > 0);
  if (segments.length === 0) throw new Error('Game state path must not be empty.');
  return writeObjectPath(root, segments, value);
}

/*** Read one object entry without dynamic property injection syntax. */
function readRecordEntry(record: GameRecord, key: string): GameValue | undefined {
  return Object.entries(record).find(([entryKey]) => entryKey === key)?.[1];
}

/*** Recursively clone objects while replacing the requested nested value. */
function writeObjectPath(
  root: GameRecord,
  segments: readonly string[],
  value: GameValue,
): GameRecord {
  const [segment, ...rest] = segments;
  if (segment === undefined) return root;
  const nextValue =
    rest.length === 0
      ? value
      : writeObjectPath(toRecord(readRecordEntry(root, segment)), rest, value);
  return replaceRecordEntry(root, segment, nextValue);
}

/*** Return one serializable value as a record or an empty record for non-object values. */
function toRecord(value: GameValue | undefined): GameRecord {
  if (value === null || value === undefined || typeof value !== 'object' || isGameArray(value)) {
    return {};
  }
  return value;
}

/*** Narrow one serializable value to a readonly game-value array. */
function isGameArray(value: GameValue): value is readonly GameValue[] {
  return Array.isArray(value);
}

/*** Immutably replace one record key without dynamic property assignment. */
function replaceRecordEntry(root: GameRecord, key: string, value: GameValue): GameRecord {
  return Object.fromEntries([
    ...Object.entries(root).filter(([entryKey]) => entryKey !== key),
    [key, value],
  ]);
}
