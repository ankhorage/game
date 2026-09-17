import type {
  GameDefinition,
  GameExecutionResult,
  GameSession,
  GameSessionInitialization,
} from '../../../../types/game';
import { applyGameEvent } from './applyGameEvent';

/*** Create and initialize one deterministic platform-neutral game session. */
export function createGameSession(
  definition: GameDefinition,
  initialization: GameSessionInitialization = {},
): GameExecutionResult {
  const firstStage = definition.stages.at(0);
  if (firstStage === undefined) throw new Error('Game definition requires at least one stage.');
  const { input = {}, seed = 0 } = initialization;
  if (!Number.isFinite(seed)) throw new Error('Game session seed must be finite.');
  const session: GameSession = {
    definitionId: definition.id,
    stageId: firstStage.id,
    phase: definition.initialPhase ?? 'playing',
    state: { ...(definition.initialState ?? {}), ...(firstStage.initialState ?? {}) },
    entities: {},
    scheduled: [],
    elapsedMs: 0,
    sequence: 0,
  };
  return applyGameEvent(definition, session, { type: 'game.start', seed }, input);
}
