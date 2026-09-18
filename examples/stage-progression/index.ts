/***
 * Compose multi-stage games with explicit transition and restart rules.
 *
 * Stage-local initial state is layered onto the session when entering the stage, while routing and
 * screens remain application concerns.
 *
 * @usage
 * @readme
 */
import { applyGameEvent, createGameSession, type GameDefinition } from '@ankhorage/game';

const game: GameDefinition = {
  id: 'stage-progression-demo',
  initialState: { score: 0 },
  stages: [
    { id: 'intro', initialState: { goal: 2 }, nextStageId: 'challenge' },
    { id: 'challenge', initialState: { goal: 5 }, nextStageId: 'result' },
    { id: 'result' },
  ],
  rules: [
    {
      id: 'complete-stage',
      event: 'stage.complete',
      effects: [
        { kind: 'transitionStage' },
        {
          kind: 'emit',
          type: 'game.stageChanged',
          payload: {
            previousStageId: { kind: 'reference', source: 'session', path: 'stageId' },
          },
        },
      ],
    },
    {
      id: 'restart-stage',
      event: 'stage.restart',
      effects: [{ kind: 'restartStage' }],
    },
  ],
};

const initial = createGameSession(game).session;
const challenge = applyGameEvent(game, initial, { type: 'stage.complete' });
const result = applyGameEvent(game, challenge.session, { type: 'stage.complete' });

console.log(result.session.stageId);
