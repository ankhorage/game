import type {
  GameDefinition,
  GameEntity,
  GameEntityPoolDefinition,
  GameInput,
  GameRecord,
  GameSession,
  GameValue,
} from '../../../types/game';
import { readGamePath, writeGamePath } from '../utils/gamePath';
import { evaluateGameCondition } from './evaluateGameCondition';
import { evaluateGameExpression } from './evaluateGameExpression';

type GameScalarId = number | string;

/*** Replace one pool's entities from caller-owned data using deterministic selectors and placement. */
export function refreshGamePool(
  definition: GameDefinition,
  session: GameSession,
  input: GameInput,
  poolId: string,
  seed: number,
): Readonly<Record<string, GameEntity>> {
  const pool = definition.pools?.find((candidate) => candidate.id === poolId);
  if (pool === undefined) throw new Error(`Unknown game pool: ${poolId}`);
  const template = definition.entityTemplates?.find(
    (candidate) => candidate.id === pool.entityTemplateId,
  );
  if (template === undefined) throw new Error(`Unknown entity template: ${pool.entityTemplateId}`);

  const source = evaluateGameExpression(pool.source, { session, input });
  if (!Array.isArray(source)) {
    throw new Error(`Game pool ${poolId} source must resolve to an array.`);
  }
  const excludedIds = collectExcludedIds(pool, session);
  const rotated = rotate(source, seed).filter(
    (item) => !excludedIds.has(readItemId(item, pool.idPath)),
  );
  const selected = selectItems(rotated, pool, session, input, seed);
  const retained = Object.fromEntries(
    Object.entries(session.entities).filter(([, entity]) => entity.poolId !== poolId),
  );
  const generated = selected.reduce<readonly (readonly [string, GameEntity])[]>(
    (entries, item, index) => {
      const itemId = readItemId(item, pool.idPath);
      const local = localContext(item, index, seed);
      const state = buildEntityState(template.initialState ?? {}, pool, session, input, local);
      const priorStates = entries.map(([, entity]) => entity.state);
      const placedState = placeEntity(state, pool, priorStates, index, seed);
      const id = `${pool.id}:${itemId}:${session.sequence + index + 1}`;
      const entity: GameEntity = {
        id,
        templateId: template.id,
        poolId: pool.id,
        state: placedState,
      };
      return [...entries, [id, entity] as const];
    },
    [],
  );
  return { ...retained, ...Object.fromEntries(generated) };
}

/*** Collect scalar item ids excluded by configured session-state paths. */
function collectExcludedIds(
  pool: GameEntityPoolDefinition,
  session: GameSession,
): ReadonlySet<GameScalarId> {
  const values = (pool.excludeIdsFromStatePaths ?? []).flatMap((path) => {
    const value = readGamePath(session.state, path);
    return Array.isArray(value) ? value.filter(isScalarId) : [];
  });
  return new Set<GameScalarId>(values);
}

/*** Select each configured group without duplicating source items. */
function selectItems(
  source: readonly GameValue[],
  pool: GameEntityPoolDefinition,
  session: GameSession,
  input: GameInput,
  seed: number,
): readonly GameValue[] {
  const selected = pool.selectors.reduce<readonly GameValue[]>((current, selector) => {
    const candidates = source.filter((item) => {
      if (
        current.some(
          (existing) => readItemId(existing, pool.idPath) === readItemId(item, pool.idPath),
        )
      ) {
        return false;
      }
      if (selector.where === undefined) return true;
      return evaluateGameCondition(selector.where, { session, input, local: { item, seed } });
    });
    return [...current, ...candidates.slice(0, selector.count)];
  }, []);
  if (selected.length !== pool.size) {
    throw new Error(
      `Game pool ${pool.id} selected ${selected.length} items; expected ${pool.size}.`,
    );
  }
  return selected;
}

/*** Build one entity's generic state from template defaults and pool expressions. */
function buildEntityState(
  initialState: GameRecord,
  pool: GameEntityPoolDefinition,
  session: GameSession,
  input: GameInput,
  local: GameRecord,
): GameRecord {
  const mapped = Object.entries(pool.entityState ?? {}).reduce<GameRecord>(
    (state, [key, expression]) => ({
      ...state,
      [key]: evaluateGameExpression(expression, { session, input, local }),
    }),
    {},
  );
  return { ...initialState, data: local.item ?? null, ...mapped };
}

/*** Place one generated entity deterministically within optional pool bounds. */
function placeEntity(
  state: GameRecord,
  pool: GameEntityPoolDefinition,
  priorStates: readonly GameRecord[],
  index: number,
  seed: number,
): GameRecord {
  const { placement } = pool;
  if (placement === undefined) return state;
  const priorPositions = priorStates.flatMap((priorState) => {
    const x = readGamePath(priorState, placement.xStatePath);
    const y = readGamePath(priorState, placement.yStatePath);
    return typeof x === 'number' && typeof y === 'number' ? [{ x, y }] : [];
  });
  const point =
    Array.from({ length: 32 }, (_, attempt) =>
      deterministicPoint(placement, index + attempt * 17, seed),
    ).find((candidate) =>
      priorPositions.every(
        (prior) =>
          Math.hypot(candidate.x - prior.x, candidate.y - prior.y) >=
          (placement.minimumDistance ?? 0),
      ),
    ) ?? deterministicPoint(placement, index, seed);
  return writeGamePath(
    writeGamePath(state, placement.xStatePath, point.x),
    placement.yStatePath,
    point.y,
  );
}

/*** Derive one stable pseudo-random point from a normalized seed and integer sequence. */
function deterministicPoint(
  placement: NonNullable<GameEntityPoolDefinition['placement']>,
  sequence: number,
  seed: number,
): { readonly x: number; readonly y: number } {
  const xRatio = fractional(seed + (sequence + 1) * 0.61803398875);
  const yRatio = fractional(seed + (sequence + 1) * 0.41421356237);
  return {
    x: placement.xMin + xRatio * (placement.xMax - placement.xMin),
    y: placement.yMin + yRatio * (placement.yMax - placement.yMin),
  };
}

/*** Rotate a readonly source list by a deterministic normalized seed. */
function rotate(values: readonly GameValue[], seed: number): readonly GameValue[] {
  if (values.length === 0) return values;
  const offset = Math.floor(fractional(seed) * values.length);
  return [...values.slice(offset), ...values.slice(0, offset)];
}

/*** Build loop-local values available to entity-state expressions. */
function localContext(item: GameValue, index: number, seed: number): GameRecord {
  return { item, index, seed, random: fractional(seed + (index + 1) * 0.754877666) };
}

/*** Read one stable scalar item id from a serializable pool item. */
function readItemId(item: GameValue, idPath = 'id'): GameScalarId {
  const id = readGamePath(item, idPath);
  if (!isScalarId(id)) {
    throw new Error(`Game pool item id at ${idPath} must be a string or number.`);
  }
  return id;
}

/*** Narrow a serializable value to a scalar entity id. */
function isScalarId(value: GameValue | undefined): value is GameScalarId {
  return typeof value === 'string' || typeof value === 'number';
}

/*** Normalize arbitrary numeric input into the deterministic half-open unit interval. */
function fractional(value: number): number {
  const finite = Number.isFinite(value) ? value : 0;
  return ((finite % 1) + 1) % 1;
}
