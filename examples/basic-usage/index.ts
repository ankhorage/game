/***
 * Configure a tiny non-product-specific collection game without executable rule callbacks.
 * @usage
 */
import { applyGameEvent, createGameSession, type GameDefinition } from '../../src/game';

const game: GameDefinition = {
  id: 'orb-collector',
  initialState: { score: 0 },
  stages: [{ id: 'round' }],
  rules: [{ id: 'collect-orb', event: 'orb.collect', effects: [{ kind: 'increment', path: 'score', value: { kind: 'literal', value: 1 } }] }],
};

const initial = createGameSession(game);
const result = applyGameEvent(game, initial, { type: 'orb.collect' });
console.log(result.session.state.score);
