/***
 * Start with the smallest config-driven game: an event matches a rule and applies an immutable
 * state effect. Keep rules serializable; UI, timers and platform input stay outside this package.
 *
 * @usage
 * @readme
 */
import { applyGameEvent, createGameSession, type GameDefinition } from '@ankhorage/game';

const game: GameDefinition = {
  id: 'orb-collector',
  initialState: { score: 0 },
  stages: [{ id: 'round' }],
  rules: [
    {
      id: 'collect-orb',
      event: 'orb.collect',
      effects: [{ kind: 'increment', path: 'score', value: { kind: 'literal', value: 1 } }],
    },
  ],
};

const initial = createGameSession(game).session;
const result = applyGameEvent(game, initial, { type: 'orb.collect' });
console.log(result.session.state.score);
