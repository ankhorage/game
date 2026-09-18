/***
 * Represent damage, hit feedback and respawn timing without browser or native timers in game logic.
 *
 * Scheduled effects stay in the session until the platform advances game time explicitly.
 *
 * @usage
 * @readme
 */
import {
  advanceGameTime,
  applyGameEvent,
  createGameSession,
  type GameDefinition,
} from '@ankhorage/game';

const game: GameDefinition = {
  id: 'damage-respawn-demo',
  initialState: {
    health: 3,
    invulnerable: false,
    playerPhase: 'active',
  },
  stages: [{ id: 'round' }],
  rules: [
    {
      id: 'take-hit',
      event: 'player.hit',
      when: {
        kind: 'not',
        condition: {
          kind: 'truthy',
          value: { kind: 'reference', source: 'state', path: 'invulnerable' },
        },
      },
      effects: [
        {
          kind: 'increment',
          path: 'health',
          value: { kind: 'literal', value: -1 },
          min: { kind: 'literal', value: 0 },
        },
        {
          kind: 'set',
          path: 'invulnerable',
          value: { kind: 'literal', value: true },
        },
        {
          kind: 'set',
          path: 'playerPhase',
          value: { kind: 'literal', value: 'hitstop' },
        },
        {
          kind: 'schedule',
          delayMs: { kind: 'literal', value: 300 },
          effects: [
            {
              kind: 'set',
              path: 'playerPhase',
              value: { kind: 'literal', value: 'respawning' },
            },
          ],
        },
        {
          kind: 'schedule',
          delayMs: { kind: 'literal', value: 600 },
          effects: [
            {
              kind: 'set',
              path: 'playerPhase',
              value: { kind: 'literal', value: 'active' },
            },
            {
              kind: 'set',
              path: 'invulnerable',
              value: { kind: 'literal', value: false },
            },
          ],
        },
      ],
    },
  ],
};

const initial = createGameSession(game).session;
const hit = applyGameEvent(game, initial, { type: 'player.hit' });
const respawning = advanceGameTime(game, hit.session, 300);
const active = advanceGameTime(game, respawning.session, 300);

console.log(active.session.state);
