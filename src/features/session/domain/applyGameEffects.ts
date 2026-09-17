import type {
  GameDefinition,
  GameEffect,
  GameEntity,
  GameExecutionContextSnapshot,
  GameExecutionResult,
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

/*** Apply one declarative effect and preserve accumulated outputs. */
function applyEffect(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: GameEffect,
  input: GameInput,
  contextSnapshot: GameExecutionContextSnapshot,
): GameExecutionResult {
  const entity = contextSnapshot.entityId === undefined ? undefined : result.session.entities[contextSnapshot.entityId];
  const context: GameExpressionContext = {
    session: result.session,
    input,
    ...(contextSnapshot.event === undefined ? {} : { event: contextSnapshot.event }),
    ...(entity === undefined ? {} : { entity }),
    ...(contextSnapshot.local === undefined ? {} : { local: contextSnapshot.local }),
  };

  if (effect.kind === 'set') return withSession(result, { ...result.session, state: writeGamePath(result.session.state, effect.path, evaluateGameExpression(effect.value, context)) });
  if (effect.kind === 'increment') return incrementState(result, effect, context);
  if (effect.kind === 'setPhase') {
    const phase = evaluateGameExpression(effect.phase, context);
    if (typeof phase !== 'string') throw new Error('setPhase requires a string expression.');
    return withSession(result, { ...result.session, phase });
  }
  if (effect.kind === 'emit') return emitOutput(result, effect.type, effect.payload, context);
  if (effect.kind === 'schedule') return scheduleEffects(result, effect, context, contextSnapshot);
  if (effect.kind === 'refreshPool') {
    const seedValue = effect.seed === undefined ? contextSnapshot.event?.seed ?? result.session.sequence : evaluateGameExpression(effect.seed, context);
    if (typeof seedValue !== 'number') throw new Error('refreshPool seed must be numeric.');
    return withSession(result, {
      ...result.session,
      entities: refreshGamePool(definition, result.session, input, effect.poolId, seedValue),
      sequence: result.session.sequence + 1,
    });
  }
  if (effect.kind === 'spawnEntity') return spawnEntity(definition, result, effect, context);
  if (effect.kind === 'removeEntity') return removeEntity(result, effect.entityId, context);
  if (effect.kind === 'forEach') return forEachValue(definition, result, effect, input, contextSnapshot, context);
  if (effect.kind === 'transitionStage') return transitionStage(definition, result, effect.stageId, effect.clearEntities ?? true, context);
  return restartStage(definition, result, effect.clearEntities ?? true);
}

/*** Increment one numeric state path with optional expression bounds. */
function incrementState(
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'increment' }>,
  context: GameExpressionContext,
): GameExecutionResult {
  const current = readGamePath(result.session.state, effect.path);
  const amount = evaluateGameExpression(effect.value, context);
  if (typeof current !== 'number' || typeof amount !== 'number') throw new Error(`increment requires numeric state at ${effect.path}.`);
  const min = effect.min === undefined ? Number.NEGATIVE_INFINITY : numeric(effect.min, context);
  const max = effect.max === undefined ? Number.POSITIVE_INFINITY : numeric(effect.max, context);
  return withSession(result, { ...result.session, state: writeGamePath(result.session.state, effect.path, Math.min(max, Math.max(min, current + amount))) });
}

/*** Resolve one expression as a finite number. */
function numeric(expression: Parameters<typeof evaluateGameExpression>[0], context: GameExpressionContext): number {
  const value = evaluateGameExpression(expression, context);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Expected numeric game expression.');
  return value;
}

/*** Append one normalized output event to the effect result. */
function emitOutput(
  result: GameExecutionResult,
  type: string,
  payloadDefinition: Readonly<Record<string, Parameters<typeof evaluateGameExpression>[0]>> | undefined,
  context: GameExpressionContext,
): GameExecutionResult {
  const payload = Object.entries(payloadDefinition ?? {}).reduce<GameRecord>(
    (record, [key, expression]) => ({ ...record, [key]: evaluateGameExpression(expression, context) }),
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
  if (typeof delayMs !== 'number' || delayMs < 0) throw new Error('schedule delay must be non-negative.');
  const scheduled = { id: result.session.sequence + result.session.scheduled.length + 1, remainingMs: delayMs, effects: effect.effects, context: contextSnapshot };
  return withSession(result, { ...result.session, scheduled: [...result.session.scheduled, scheduled] });
}

/*** Instantiate one entity template with state expressions. */
function spawnEntity(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'spawnEntity' }>,
  context: GameExpressionContext,
): GameExecutionResult {
  const template = definition.entityTemplates?.find((candidate) => candidate.id === effect.templateId);
  if (template === undefined) throw new Error(`Unknown entity template: ${effect.templateId}`);
  const idValue = evaluateGameExpression(effect.id, context);
  if (typeof idValue !== 'string' && typeof idValue !== 'number') throw new Error('spawnEntity id must resolve to string or number.');
  const id = String(idValue);
  const mappedState = Object.entries(effect.state ?? {}).reduce<GameRecord>((state, [key, expression]) => ({ ...state, [key]: evaluateGameExpression(expression, context) }), {});
  const entity: GameEntity = { id, templateId: template.id, state: { ...(template.initialState ?? {}), ...mappedState } };
  return withSession(result, { ...result.session, entities: { ...result.session.entities, [id]: entity }, sequence: result.session.sequence + 1 });
}

/*** Remove one entity by expression-resolved id. */
function removeEntity(
  result: GameExecutionResult,
  idExpression: Parameters<typeof evaluateGameExpression>[0],
  context: GameExpressionContext,
): GameExecutionResult {
  const id = String(evaluateGameExpression(idExpression, context));
  const entities = Object.fromEntries(Object.entries(result.session.entities).filter(([entityId]) => entityId !== id));
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
  const values: readonly GameValue[] = typeof source === 'string' ? [...source] : Array.isArray(source) ? source : [];
  if (!Array.isArray(source) && typeof source !== 'string') throw new Error('forEach source must be array or string.');
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
  stageExpression: Parameters<typeof evaluateGameExpression>[0] | undefined,
  clearEntities: boolean,
  context: GameExpressionContext,
): GameExecutionResult {
  const currentStage = stageById(definition, result.session.stageId);
  const stageIdValue = stageExpression === undefined ? currentStage.nextStageId : evaluateGameExpression(stageExpression, context);
  if (typeof stageIdValue !== 'string') throw new Error('transitionStage requires a target stage id.');
  return withSession(result, resetForStage(result.session, stageById(definition, stageIdValue), clearEntities));
}

/*** Rebuild the current stage while preserving global session values. */
function restartStage(definition: GameDefinition, result: GameExecutionResult, clearEntities: boolean): GameExecutionResult {
  return withSession(result, resetForStage(result.session, stageById(definition, result.session.stageId), clearEntities));
}

/*** Reset stage-owned state and transient scheduling for one stage entry. */
function resetForStage(session: GameSession, stage: GameStageDefinition, clearEntities: boolean): GameSession {
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

/*** Replace only the session while preserving already emitted outputs. */
function withSession(result: GameExecutionResult, session: GameSession): GameExecutionResult { return { ...result, session }; }
