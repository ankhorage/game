import type { GameDefinition, GameSession } from '../../../../types/game';

/*** Create one fresh platform-neutral game session from a serializable definition. */
export function createGameSession(definition: GameDefinition): GameSession {
  const firstStage = definition.stages.at(0);
  if (firstStage === undefined) throw new Error('Game definition requires at least one stage.');
  return {
    definitionId: definition.id,
    stageId: firstStage.id,
    phase: definition.initialPhase ?? 'playing',
    state: { ...(definition.initialState ?? {}), ...(firstStage.initialState ?? {}) },
    entities: {},
    scheduled: [],
    elapsedMs: 0,
    sequence: 0,
  };
}
