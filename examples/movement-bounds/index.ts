/***
 * Model direct movement as state updates with declarative clamping.
 *
 * UI adapters only report the requested coordinate; the Game definition owns the legal bounds.
 *
 * @usage
 * @readme
 */
import { applyGameEvent, createGameSession, type GameDefinition } from '@ankhorage/game';

const game: GameDefinition = {
  id: 'movement-demo',
  initialState: {
    player: { x: 50, minX: 10, maxX: 90 },
  },
  stages: [{ id: 'round' }],
  rules: [
    {
      id: 'move-player',
      event: 'player.move',
      effects: [
        {
          kind: 'set',
          path: 'player.x',
          value: {
            kind: 'clamp',
            value: { kind: 'reference', source: 'event', path: 'x' },
            min: { kind: 'reference', source: 'state', path: 'player.minX' },
            max: { kind: 'reference', source: 'state', path: 'player.maxX' },
          },
        },
      ],
    },
  ],
};

const initial = createGameSession(game).session;
const moved = applyGameEvent(game, initial, {
  type: 'player.move',
  payload: { x: 120 },
});

console.log(moved.session.state.player);
