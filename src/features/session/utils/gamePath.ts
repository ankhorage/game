import type { GameRecord, GameValue } from '../../../types/game';

/*** Read one dot-separated value path from a serializable game value. */
export function readGamePath(value: GameValue | undefined, path?: string): GameValue | undefined {
  if (path === undefined || path.length === 0) return value;
  return path.split('.').reduce<GameValue | undefined>((current, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current.at(index) : undefined;
    }
    if (typeof current !== 'object') return undefined;
    return (current as Readonly<Record<string, GameValue>>)[segment];
  }, value);
}

/*** Immutably write one dot-separated object path in game state. */
export function writeGamePath(root: GameRecord, path: string, value: GameValue): GameRecord {
  const segments = path.split('.').filter((segment) => segment.length > 0);
  if (segments.length === 0) throw new Error('Game state path must not be empty.');
  return writeObjectPath(root, segments, value);
}

/*** Recursively clone objects while replacing the requested nested value. */
function writeObjectPath(root: GameRecord, segments: readonly string[], value: GameValue): GameRecord {
  const [segment, ...rest] = segments;
  if (segment === undefined) return root;
  if (rest.length === 0) return { ...root, [segment]: value };
  const existing = root[segment];
  const nested = isRecord(existing) ? existing : {};
  return { ...root, [segment]: writeObjectPath(nested, rest, value) };
}

/*** Narrow one serializable game value to a readonly object record. */
function isRecord(value: GameValue | undefined): value is GameRecord {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value);
}
