/***
 * Keep projectile lifecycle and collision decisions platform-neutral.
 *
 * Presentation or geometry adapters report collision events; Game rules decide what those events
 * mean and update entities/state without reading DOM or native layout.
 *
 * @usage
 * @readme
 */
import { applyGameEvent, createGameSession, type GameDefinition } from '@ankhorage/game';

const game: GameDefinition = {
  id: 'projectile-collision-demo',
  initialState: { health: 3 },
  stages: [{ id: 'round' }],
  entityTemplates: [{ id: 'projectile' }],
  rules: [
    {
      id: 'fire-projectile',
      event: 'projectile.fire',
      effects: [
        {
          kind: 'spawnEntity',
          templateId: 'projectile',
          id: { kind: 'reference', source: 'event', path: 'projectileId' },
          state: {
            glyph: { kind: 'reference', source: 'event', path: 'glyph' },
          },
        },
      ],
    },
    {
      id: 'projectile-hit',
      event: 'collision.enter',
      effects: [
        {
          kind: 'increment',
          path: 'health',
          value: { kind: 'literal', value: -1 },
          min: { kind: 'literal', value: 0 },
        },
        {
          kind: 'removeEntity',
          entityId: { kind: 'reference', source: 'event', path: 'projectileId' },
        },
      ],
    },
  ],
};

const initial = createGameSession(game).session;
const fired = applyGameEvent(game, initial, {
  type: 'projectile.fire',
  payload: { projectileId: 'shot-1', glyph: 'A' },
});
const hit = applyGameEvent(game, fired.session, {
  type: 'collision.enter',
  payload: { projectileId: 'shot-1' },
});

console.log(hit.session.state.health, Object.keys(hit.session.entities));
