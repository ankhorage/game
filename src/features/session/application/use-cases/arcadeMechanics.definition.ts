import type {
  GameDefinition,
  GameInput,
  GameReferenceSource,
} from '../../../../types/game';

const ref = (source: GameReferenceSource, path?: string) =>
  path === undefined
    ? ({ kind: 'reference', source } as const)
    : ({ kind: 'reference', source, path } as const);

const literal = (value: boolean | null | number | string) => ({ kind: 'literal', value }) as const;

export const arcadeDefinition: GameDefinition = {
  id: 'lane-action-fixture',
  initialState: {
    health: 3,
    maxHealth: 5,
    invulnerable: false,
    playerPhase: 'active',
    progress: 0,
    targetCount: 2,
    correctStreak: 0,
    recentIds: [],
  },
  stages: [{ id: 'round', initialState: { targetTag: 'match' } }],
  entityTemplates: [{ id: 'actor' }, { id: 'projectile' }],
  pools: [
    {
      id: 'actors',
      source: ref('input', 'items'),
      entityTemplateId: 'actor',
      size: 2,
      excludeIdsFromStatePaths: ['recentIds'],
      selectors: [
        {
          count: 1,
          where: {
            kind: 'equals',
            left: ref('local', 'item.tag'),
            right: ref('state', 'targetTag'),
          },
        },
        {
          count: 1,
          where: {
            kind: 'notEquals',
            left: ref('local', 'item.tag'),
            right: ref('state', 'targetTag'),
          },
        },
      ],
    },
  ],
  rules: [
    {
      id: 'start',
      event: 'game.start',
      effects: [{ kind: 'refreshPool', poolId: 'actors' }],
    },
    {
      id: 'refresh-board',
      event: 'board.refresh',
      effects: [
        {
          kind: 'forEach',
          source: { kind: 'entities', poolId: 'actors' },
          effects: [
            {
              kind: 'append',
              path: 'recentIds',
              value: ref('local', 'item.data.id'),
              maxLength: 2,
            },
          ],
        },
        { kind: 'refreshPool', poolId: 'actors' },
      ],
    },
    {
      id: 'resolve-match',
      event: 'actor.resolve',
      when: {
        kind: 'equals',
        left: ref('entity', 'data.tag'),
        right: ref('state', 'targetTag'),
      },
      effects: [
        { kind: 'increment', path: 'progress', value: literal(1) },
        { kind: 'increment', path: 'correctStreak', value: literal(1) },
        { kind: 'emit', type: 'game.itemResolved', payload: { itemId: ref('entity', 'data.id') } },
      ],
    },
    {
      id: 'reward-streak',
      event: 'actor.resolve',
      when: {
        kind: 'all',
        conditions: [
          {
            kind: 'equals',
            left: ref('entity', 'data.tag'),
            right: ref('state', 'targetTag'),
          },
          {
            kind: 'greaterThanOrEqual',
            left: ref('state', 'correctStreak'),
            right: literal(2),
          },
        ],
      },
      effects: [
        {
          kind: 'increment',
          path: 'health',
          value: literal(1),
          max: ref('state', 'maxHealth'),
        },
        { kind: 'set', path: 'correctStreak', value: literal(0) },
      ],
    },
    {
      id: 'complete-round',
      event: 'actor.resolve',
      when: {
        kind: 'greaterThanOrEqual',
        left: ref('state', 'progress'),
        right: ref('state', 'targetCount'),
      },
      effects: [{ kind: 'setPhase', phase: literal('level-complete') }],
    },
    {
      id: 'resolve-penalty',
      event: 'actor.resolve',
      when: {
        kind: 'notEquals',
        left: ref('entity', 'data.tag'),
        right: ref('state', 'targetTag'),
      },
      effects: [
        { kind: 'set', path: 'correctStreak', value: literal(0) },
        { kind: 'increment', path: 'health', value: literal(-1), min: literal(0) },
        {
          kind: 'forEach',
          source: { kind: 'split', value: ref('entity', 'data.penaltyText'), separator: '' },
          effects: [
            {
              kind: 'spawnEntity',
              templateId: 'projectile',
              id: {
                kind: 'join',
                separator: ':',
                values: [literal('projectile'), ref('session', 'sequence'), ref('local', 'index')],
              },
              state: { glyph: ref('local', 'item') },
            },
          ],
        },
      ],
    },
    {
      id: 'collision-damage',
      event: 'collision.enter',
      when: {
        kind: 'all',
        conditions: [
          { kind: 'equals', left: ref('event', 'target'), right: literal('player') },
          { kind: 'equals', left: ref('state', 'invulnerable'), right: literal(false) },
        ],
      },
      effects: [
        { kind: 'increment', path: 'health', value: literal(-1), min: literal(0) },
        { kind: 'set', path: 'invulnerable', value: literal(true) },
        { kind: 'set', path: 'playerPhase', value: literal('hitstop') },
        {
          kind: 'schedule',
          delayMs: literal(100),
          effects: [
            { kind: 'removeEntity', entityId: ref('entity', 'id') },
            { kind: 'set', path: 'playerPhase', value: literal('hidden') },
          ],
        },
        {
          kind: 'schedule',
          delayMs: literal(300),
          effects: [{ kind: 'set', path: 'playerPhase', value: literal('respawning') }],
        },
        {
          kind: 'schedule',
          delayMs: literal(500),
          effects: [{ kind: 'set', path: 'playerPhase', value: literal('active') }],
        },
        {
          kind: 'schedule',
          delayMs: literal(800),
          effects: [{ kind: 'set', path: 'invulnerable', value: literal(false) }],
        },
      ],
    },
    {
      id: 'collision-game-over',
      event: 'collision.enter',
      when: { kind: 'equals', left: ref('state', 'health'), right: literal(0) },
      effects: [{ kind: 'setPhase', phase: literal('game-over') }],
    },
  ],
};

export const arcadeInput: GameInput = {
  items: [
    { id: 'a', tag: 'match', penaltyText: 'AX' },
    { id: 'b', tag: 'other', penaltyText: 'BY' },
    { id: 'c', tag: 'match', penaltyText: 'CZ' },
    { id: 'd', tag: 'other', penaltyText: 'DW' },
  ],
};
