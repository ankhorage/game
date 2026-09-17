import type {
  GameDefinition,
  GameEffect,
  GameExecutionResult,
  GameExpression,
  GameSession,
  GameStageDefinition,
} from '../../../types/game';
import { evaluateGameExpression, type GameExpressionContext } from './evaluateGameExpression';

/*** Apply one stage transition or restart effect. */
export function applyLifecycleEffect(
  definition: GameDefinition,
  result: GameExecutionResult,
  effect: GameEffect,
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
  if (effect.kind === 'restartStage') {
    return restartStage(definition, result, effect.clearEntities ?? true);
  }
  throw new Error(`Unsupported lifecycle effect: ${effect.kind}`);
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

/*** Replace only the session while preserving already emitted outputs. */
function withSession(result: GameExecutionResult, session: GameSession): GameExecutionResult {
  return { ...result, session };
}
