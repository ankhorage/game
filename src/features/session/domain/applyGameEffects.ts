import type {
  GameDefinition,
  GameEffect,
  GameExecutionContextSnapshot,
  GameExecutionResult,
  GameInput,
  GameSession,
} from '../../../types/game';
import { applyEntityEffect } from './applyEntityEffect';
import { applyLifecycleEffect } from './applyLifecycleEffect';
import { applyStateEffect } from './applyStateEffect';
import type { GameExpressionContext } from './evaluateGameExpression';

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
  const context = createExpressionContext(result.session, input, contextSnapshot);
  if (isEntityEffect(effect)) {
    return applyEntityEffect(
      definition,
      result,
      effect,
      contextSnapshot,
      context,
      (nestedSession, nestedEffects, nestedContext) =>
        applyGameEffects(definition, nestedSession, nestedEffects, input, nestedContext),
    );
  }
  if (isLifecycleEffect(effect)) {
    return applyLifecycleEffect(definition, result, effect, context);
  }
  return applyStateEffect(definition, result, effect, input, contextSnapshot, context);
}

/*** Build expression context from one immutable session and captured event/local state. */
function createExpressionContext(
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

/*** Return whether one effect belongs to entity operations. */
function isEntityEffect(effect: GameEffect): boolean {
  return (
    effect.kind === 'spawnEntity' ||
    effect.kind === 'removeEntity' ||
    effect.kind === 'forEach'
  );
}

/*** Return whether one effect belongs to stage lifecycle operations. */
function isLifecycleEffect(effect: GameEffect): boolean {
  return effect.kind === 'transitionStage' || effect.kind === 'restartStage';
}
