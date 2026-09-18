/***
 * Build data-driven boards from caller-owned input with deterministic entity pools.
 *
 * Use selectors for target/distractor-style composition and keep presentation details outside the
 * runtime definition.
 *
 * @usage
 * @readme
 */
import { createGameSession, type GameDefinition, type GameInput } from '@ankhorage/game';

const input: GameInput = {
  items: [
    { id: 'a', tag: 'target' },
    { id: 'b', tag: 'other' },
    { id: 'c', tag: 'other' },
    { id: 'd', tag: 'target' },
  ],
};

const game: GameDefinition = {
  id: 'entity-pool-demo',
  initialState: { targetTag: 'target' },
  stages: [{ id: 'round' }],
  entityTemplates: [{ id: 'token' }],
  pools: [
    {
      id: 'board',
      source: { kind: 'reference', source: 'input', path: 'items' },
      entityTemplateId: 'token',
      size: 3,
      selectors: [
        {
          count: 1,
          where: {
            kind: 'equals',
            left: { kind: 'reference', source: 'local', path: 'item.tag' },
            right: { kind: 'reference', source: 'state', path: 'targetTag' },
          },
        },
        { count: 2 },
      ],
      idPath: 'id',
      entityState: {
        data: { kind: 'reference', source: 'local', path: 'item' },
      },
    },
  ],
  rules: [],
};

const session = createGameSession(game, { input, seed: 0.25 }).session;
console.log(Object.values(session.entities).map((entity) => entity.state.data));
