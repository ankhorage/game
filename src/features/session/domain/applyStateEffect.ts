import type {
  GameDefinition,
  GameEffect,
  GameExecutionContextSnapshot,
  GameExecutionResult,
  GameExpression,
  GameInput,
  GameOutput,
  GameRecord,
  GameSession,
  GameValue,
} from '../../../types/game';
import { readGamePath, writeGamePath } from '../utils/gamePath';
import { evaluateGameExpression, type GameExpressionContext } from './evaluateGameExpression';
import { refreshGamePool } from './refreshGamePool';

/*** Apply one state/output/scheduling effect. */
export function applyStateEffect(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: GameEffect,
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
    case 'append':
      return appendState(result, effect, context);
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
    default:
      throw new Error(`Unsupported state effect: ${effect.kind}`);
  }
}

/*** Append one evaluated value to an array state path with an optional bounded history. */
function appendState(
  result: GameExecutionResult,
  effect: Extract<GameEffect, { readonly kind: 'append' }>,
  context: GameExpressionContext,
): GameExecutionResult {
  const current = readGamePath(result.session.state, effect.path);
  if (current !== undefined && !isGameValueArray(current)) {
    throw new Error(`append requires array state at ${effect.path}.`);
  }
  if (effect.maxLength !== undefined && (!Number.isInteger(effect.maxLength) || effect.maxLength < 0)) {
    throw new Error('append maxLength must be a non-negative integer.');
  }
  const appended = [...(current ?? []), evaluateGameExpression(effect.value, context)];
  const next = effect.maxLength === undefined ? appended : appended.slice(-effect.maxLength);
  return withSession(result, {
    ...result.session,
    state: writeGamePath(result.session.state, effect.path, next),
  });
}

/*** Narrow one serializable state value to a readonly array. */
function isGameValueArray(value: GameValue): value is readonly GameValue[] {
  return Array.isArray(value);
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

/*** Replace only the session while preserving already emitted outputs. */
function withSession(result: GameExecutionResult, session: GameSession): GameExecutionResult {
  return { ...result, session };
}
