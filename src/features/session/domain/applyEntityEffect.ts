import type {
  GameDefinition,
  GameEffect,
  GameExecutionContextSnapshot,
  GameExecutionResult,
  GameExpression,
  GameRecord,
  GameSession,
  GameValue,
} from '../../../types/game';
import { evaluateGameExpression, type GameExpressionContext } from './evaluateGameExpression';

/*** Apply one entity creation/removal/iteration effect. */
export function applyEntityEffect(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: GameEffect,
  contextSnapshot: GameExecutionContextSnapshot,
  context: GameExpressionContext,
  applyNestedEffects: ApplyNestedEffects,
): GameExecutionResult {
  if (effect.kind === 'spawnEntity') return spawnEntity(definition, result, effect, context);
  if (effect.kind === 'removeEntity') return removeEntity(result, effect.entityId, context);
  if (effect.kind === 'forEach') {
    return forEachValue(result, effect, contextSnapshot, context, applyNestedEffects);
  }
  throw new Error(`Unsupported entity effect: ${effect.kind}`);
}

type ApplyNestedEffects = (
  session: GameSession,
  effects: readonly GameEffect[],
  context: GameExecutionContextSnapshot,
) => GameExecutionResult;

/*** Instantiate one entity template with state expressions. */
function spawnEntity(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'spawnEntity' }>,
  context: GameExpressionContext,
): GameExecutionResult {
  const template = definition.entityTemplates?.find(
    (candidate) => candidate.id === effect.templateId,
  );
  if (template === undefined) throw new Error(`Unknown entity template: ${effect.templateId}`);
  const id = scalarId(evaluateGameExpression(effect.id, context), 'spawnEntity id');
  const mappedState = Object.entries(effect.state ?? {}).reduce<GameRecord>(
    (state, [key, expression]) => ({
      ...state,
      [key]: evaluateGameExpression(expression, context),
    }),
    {},
  );
  const entity = {
    id,
    templateId: template.id,
    state: { ...(template.initialState ?? {}), ...mappedState },
  };
  const entities = Object.fromEntries([
    ...Object.entries(result.session.entities).filter(([entityId]) => entityId !== id),
    [id, entity],
  ]);
  return withSession(result, {
    ...result.session,
    entities,
    sequence: result.session.sequence + 1,
  });
}

/*** Remove one entity by expression-resolved scalar id. */
function removeEntity(
  result: GameExecutionResult,
  idExpression: GameExpression,
  context: GameExpressionContext,
): GameExecutionResult {
  const id = scalarId(evaluateGameExpression(idExpression, context), 'removeEntity id');
  const entities = Object.fromEntries(
    Object.entries(result.session.entities).filter(([entityId]) => entityId !== id),
  );
  return withSession(result, { ...result.session, entities });
}

/*** Apply nested effects once per array/string item with explicit loop-local context. */
function forEachValue(
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'forEach' }>,
  contextSnapshot: GameExecutionContextSnapshot,
  context: GameExpressionContext,
  applyNestedEffects: ApplyNestedEffects,
): GameExecutionResult {
  const source = evaluateGameExpression(effect.source, context);
  if (typeof source !== 'string' && !isGameValueArray(source)) {
    throw new Error('forEach source must be array or string.');
  }
  const values: readonly GameValue[] = typeof source === 'string' ? [...source] : source;
  return values.reduce<GameExecutionResult>((current, item, index) => {
    const nested = applyNestedEffects(current.session, effect.effects, {
      ...contextSnapshot,
      local: { ...(contextSnapshot.local ?? {}), item, index },
    });
    return {
      session: nested.session,
      outputs: [...current.outputs, ...nested.outputs],
    };
  }, result);
}

/*** Narrow a serializable game value to an array. */
function isGameValueArray(value: GameValue): value is readonly GameValue[] {
  return Array.isArray(value);
}

/*** Resolve one serializable value to a stable scalar entity id string. */
function scalarId(value: GameValue, label: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${label} must resolve to string or number.`);
  }
  return String(value);
}

/*** Replace only the session while preserving already emitted outputs. */
function withSession(result: GameExecutionResult, session: GameSession): GameExecutionResult {
  return { ...result, session };
}
