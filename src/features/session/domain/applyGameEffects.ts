import type {
  GameDefinition,
  GameEffect,
  GameEntity,
  GameExecutionContextSnapshot,
  GameExecutionResult,
  GameExpression,
  GameInput,
  GameOutput,
  GameRecord,
  GameSession,
  GameStageDefinition,
  GameValue,
} from '../../../types/game';
import { readGamePath, writeGamePath } from '../utils/gamePath';
import { evaluateGameExpression, type GameExpressionContext } from './evaluateGameExpression';
import { refreshGamePool } from './refreshGamePool';

/*** Apply a sequence of declarative effects to one immutable game session. */
export function applyGameEffects(
  definition: GameDefinition,
  session: GameSession,
  effects: readonly GameEffect[],
  input: GameInput,
  contextSnapshot: GameExecutionContextSnapshot = {},
): GameExecutionResult {
  return effects.reduce<GameExecutionResult>(
    (result, effect) => applyEffect(definition, result, effect, input, contextSnapshot),
    { session, outputs: [] },
  );
}

/*** Route one declarative effect to its focused state, entity, or lifecycle handler. */
function applyEffect(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: GameEffect,
  input: GameInput,
  contextSnapshot: GameExecutionContextSnapshot,
): GameExecutionResult {
  const context = expressionContext(result.session, input, contextSnapshot);
  if (isEntityEffect(effect)) {
    return applyEntityEffect(definition, result, effect, input, contextSnapshot, context);
  }
  if (isLifecycleEffect(effect)) {
    return applyLifecycleEffect(definition, result, effect, context);
  }
  return applyStateEffect(definition, result, effect, input, contextSnapshot, context);
}

/*** Apply one state/output/scheduling effect. */
function applyStateEffect(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: StateEffect,
  input: GameInput,
  contextSnapshot: GameExecutionContextSnapshot,
  context: GameExpressionContext,
): GameExecutionResult {
  switch (effect.kind) {
    case 'set':
      return withSession(result, {
        ...result.session,
        state: writeGamePath(
          result.session.state,
          effect.path,
          evaluateGameExpression(effect.value, context),
        ),
      });
    case 'increment':
      return incrementState(result, effect, context);
    case 'setPhase':
      return setPhase(result, effect.phase, context);
    case 'emit':
      return emitOutput(result, effect.type, effect.payload, context);
    case 'schedule':
      return scheduleEffects(result, effect, context, contextSnapshot);
    case 'refreshPool':
      return refreshPool(definition, result, effect, input, contextSnapshot, context);
  }
}

/*** Apply one entity creation/removal/iteration effect. */
function applyEntityEffect(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: EntityEffect,
  input: GameInput,
  contextSnapshot: GameExecutionContextSnapshot,
  context: GameExpressionContext,
): GameExecutionResult {
  if (effect.kind === 'spawnEntity') return spawnEntity(definition, result, effect, context);
  if (effect.kind === 'removeEntity') return removeEntity(result, effect.entityId, context);
  return forEachValue(definition, result, effect, input, contextSnapshot, context);
}

/*** Apply one stage transition or restart effect. */
function applyLifecycleEffect(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: LifecycleEffect,
  context: GameExpressionContext,
): GameExecutionResult {
  if (effect.kind === 'transitionStage') {
    return transitionStage(
      definition,
      result,
      effect.stageId,
      effect.clearEntities ?? true,
      context,
    );
  }
  return restartStage(definition, result, effect.clearEntities ?? true);
}

/*** Build expression context from one immutable session and captured event/local state. */
function expressionContext(
  session: GameSession,
  input: GameInput,
  contextSnapshot: GameExecutionContextSnapshot,
): GameExpressionContext {
  const entity =
    contextSnapshot.entityId === undefined
      ? undefined
      : Object.values(session.entities).find(
          (candidate) => candidate.id === contextSnapshot.entityId,
        );
  return {
    session,
    input,
    ...(contextSnapshot.event === undefined ? {} : { event: contextSnapshot.event }),
    ...(entity === undefined ? {} : { entity }),
    ...(contextSnapshot.local === undefined ? {} : { local: contextSnapshot.local }),
  };
}

/*** Increment one numeric state path with optional expression bounds. */
function incrementState(
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'increment' }>,
  context: GameExpressionContext,
): GameExecutionResult {
  const current = readGamePath(result.session.state, effect.path);
  const amount = evaluateGameExpression(effect.value, context);
  if (typeof current !== 'number' || typeof amount !== 'number') {
    throw new Error(`increment requires numeric state at ${effect.path}.`);
  }
  const min = effect.min === undefined ? Number.NEGATIVE_INFINITY : numeric(effect.min, context);
  const max = effect.max === undefined ? Number.POSITIVE_INFINITY : numeric(effect.max, context);
  return withSession(result, {
    ...result.session,
    state: writeGamePath(
      result.session.state,
      effect.path,
      Math.min(max, Math.max(min, current + amount)),
    ),
  });
}

/*** Resolve one expression as a finite number. */
function numeric(expression: GameExpression, context: GameExpressionContext): number {
  const value = evaluateGameExpression(expression, context);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Expected numeric game expression.');
  }
  return value;
}

/*** Set one string-valued session phase. */
function setPhase(
  result: GameExecutionResult,
  phaseExpression: GameExpression,
  context: GameExpressionContext,
): GameExecutionResult {
  const phase = evaluateGameExpression(phaseExpression, context);
  if (typeof phase !== 'string') throw new Error('setPhase requires a string expression.');
  return withSession(result, { ...result.session, phase });
}

/*** Append one normalized output event to the effect result. */
function emitOutput(
  result: GameExecutionResult,
  type: string,
  payloadDefinition: Readonly<Record<string, GameExpression>> | undefined,
  context: GameExpressionContext,
): GameExecutionResult {
  const payload = Object.entries(payloadDefinition ?? {}).reduce<GameRecord>(
    (record, [key, expression]) => ({
      ...record,
      [key]: evaluateGameExpression(expression, context),
    }),
    {},
  );
  const output: GameOutput = { type, payload };
  return { ...result, outputs: [...result.outputs, output] };
}

/*** Add delayed effects to the session without owning a platform timer. */
function scheduleEffects(
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'schedule' }>,
  context: GameExpressionContext,
  contextSnapshot: GameExecutionContextSnapshot,
): GameExecutionResult {
  const delayMs = evaluateGameExpression(effect.delayMs, context);
  if (typeof delayMs !== 'number' || delayMs < 0) {
    throw new Error('schedule delay must be non-negative.');
  }
  const scheduled = {
    id: result.session.sequence + result.session.scheduled.length + 1,
    remainingMs: delayMs,
    effects: effect.effects,
    context: contextSnapshot,
  };
  return withSession(result, {
    ...result.session,
    scheduled: [...result.session.scheduled, scheduled],
  });
}

/*** Refresh one configured entity pool from explicit caller-owned input. */
function refreshPool(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'refreshPool' }>,
  input: GameInput,
  contextSnapshot: GameExecutionContextSnapshot,
  context: GameExpressionContext,
): GameExecutionResult {
  const seedValue =
    effect.seed === undefined
      ? (contextSnapshot.event?.seed ?? result.session.sequence)
      : evaluateGameExpression(effect.seed, context);
  if (typeof seedValue !== 'number') throw new Error('refreshPool seed must be numeric.');
  return withSession(result, {
    ...result.session,
    entities: refreshGamePool(definition, result.session, input, effect.poolId, seedValue),
    sequence: result.session.sequence + 1,
  });
}

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
  const entity: GameEntity = {
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
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'forEach' }>,
  input: GameInput,
  contextSnapshot: GameExecutionContextSnapshot,
  context: GameExpressionContext,
): GameExecutionResult {
  const source = evaluateGameExpression(effect.source, context);
  if (!Array.isArray(source) && typeof source !== 'string') {
    throw new Error('forEach source must be array or string.');
  }
  const values: readonly GameValue[] = typeof source === 'string' ? [...source] : source;
  return values.reduce<GameExecutionResult>((current, item, index) => {
    const nested = applyGameEffects(definition, current.session, effect.effects, input, {
      ...contextSnapshot,
      local: { ...(contextSnapshot.local ?? {}), item, index },
    });
    return { session: nested.session, outputs: [...current.outputs, ...nested.outputs] };
  }, result);
}

/*** Transition to an explicit or configured next stage and apply its initial state. */
function transitionStage(
  definition: GameDefinition,
  result: GameExecutionResult,
  stageExpression: GameExpression | undefined,
  clearEntities: boolean,
  context: GameExpressionContext,
): GameExecutionResult {
  const currentStage = stageById(definition, result.session.stageId);
  const stageIdValue =
    stageExpression === undefined
      ? currentStage.nextStageId
      : evaluateGameExpression(stageExpression, context);
  if (typeof stageIdValue !== 'string') {
    throw new Error('transitionStage requires a target stage id.');
  }
  return withSession(
    result,
    resetForStage(result.session, stageById(definition, stageIdValue), clearEntities),
  );
}

/*** Rebuild the current stage while preserving global session values. */
function restartStage(
  definition: GameDefinition,
  result: GameExecutionResult,
  clearEntities: boolean,
): GameExecutionResult {
  return withSession(
    result,
    resetForStage(result.session, stageById(definition, result.session.stageId), clearEntities),
  );
}

/*** Reset stage-owned state and transient scheduling for one stage entry. */
function resetForStage(
  session: GameSession,
  stage: GameStageDefinition,
  clearEntities: boolean,
): GameSession {
  return {
    ...session,
    stageId: stage.id,
    phase: 'playing',
    state: { ...session.state, ...(stage.initialState ?? {}) },
    entities: clearEntities ? {} : session.entities,
    scheduled: [],
    sequence: session.sequence + 1,
  };
}

/*** Resolve one stage definition or throw a useful configuration error. */
function stageById(definition: GameDefinition, stageId: string): GameStageDefinition {
  const stage = definition.stages.find((candidate) => candidate.id === stageId);
  if (stage === undefined) throw new Error(`Unknown game stage: ${stageId}`);
  return stage;
}

/*** Resolve one serializable value to a stable scalar entity id string. */
function scalarId(value: GameValue, label: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${label} must resolve to string or number.`);
  }
  return String(value);
}

/*** Narrow effects owned by entity operations. */
function isEntityEffect(effect: GameEffect): effect is EntityEffect {
  return (
    effect.kind === 'spawnEntity' ||
    effect.kind === 'removeEntity' ||
    effect.kind === 'forEach'
  );
}

/*** Narrow effects owned by stage lifecycle operations. */
function isLifecycleEffect(effect: GameEffect): effect is LifecycleEffect {
  return effect.kind === 'transitionStage' || effect.kind === 'restartStage';
}

/*** Replace only the session while preserving already emitted outputs. */
function withSession(result: GameExecutionResult, session: GameSession): GameExecutionResult {
  return { ...result, session };
}

type EntityEffect = Extract<
  GameEffect,
  { readonly kind: 'forEach' | 'removeEntity' | 'spawnEntity' }
>;
type LifecycleEffect = Extract<
  GameEffect,
  { readonly kind: 'restartStage' | 'transitionStage' }
>;
type StateEffect = Exclude<GameEffect, EntityEffect | LifecycleEffect>;
