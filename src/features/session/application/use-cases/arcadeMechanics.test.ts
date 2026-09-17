import { describe, expect, test } from 'bun:test';

import type {
  GameDefinition,
  GameEntity,
  GameInput,
  GameRecord,
  GameReferenceSource,
  GameSession,
  GameValue,
} from '../../../../types/game';
import { advanceGameTime } from './advanceGameTime';
import { applyGameEvent } from './applyGameEvent';
import { createGameSession } from './createGameSession';

const ref = (source: GameReferenceSource, path?: string) =>
  path === undefined
    ? ({ kind: 'reference', source } as const)
    : ({ kind: 'reference', source, path } as const);
const literal = (value: boolean | null | number | string) => ({ kind: 'literal', value }) as const;

const definition: GameDefinition = {
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
          { kind: 'greaterThanOrEqual', left: ref('state', 'correctStreak'), right: literal(2) },
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

const input: GameInput = {
  items: [
    { id: 'a', tag: 'match', penaltyText: 'AX' },
    { id: 'b', tag: 'other', penaltyText: 'BY' },
    { id: 'c', tag: 'match', penaltyText: 'CZ' },
    { id: 'd', tag: 'other', penaltyText: 'DW' },
  ],
};

describe('generic arcade mechanics', () => {
  test('refreshes a board without immediately repeating its current item ids', () => {
    const started = startGame(0);
    const firstIds = actorDataIds(started.session);
    const refreshed = applyGameEvent(
      definition,
      started.session,
      { type: 'board.refresh', seed: 0.5 },
      input,
    );
    const nextIds = actorDataIds(refreshed.session);
    expect(nextIds.every((id) => !firstIds.includes(id))).toBe(true);
  });

  test('handles progress, streak rewards, outputs and completion from rules', () => {
    const started = startGame(0);
    const target = actorByTag(started.session, 'match');
    const first = applyGameEvent(definition, started.session, resolveEvent(target), input);
    expect(first.outputs[0]?.type).toBe('game.itemResolved');
    expect(first.session.state.progress).toBe(1);
    const second = applyGameEvent(definition, first.session, resolveEvent(target), input);
    expect(second.session.state.health).toBe(4);
    expect(second.session.state.correctStreak).toBe(0);
    expect(second.session.phase).toBe('level-complete');
  });

  test('creates one generic projectile entity per configured text character', () => {
    const started = startGame(0);
    const penaltyActor = actorByTag(started.session, 'other');
    const resolved = applyGameEvent(definition, started.session, resolveEvent(penaltyActor), input);
    const projectiles = projectileEntities(resolved.session);
    expect(resolved.session.state.health).toBe(2);
    expect(projectiles.map((entity) => entity.state.glyph).sort()).toEqual(['B', 'Y']);
    expect(new Set(projectiles.map((entity) => entity.id)).size).toBe(2);
  });

  test('applies collision damage once and drives hitstop, respawn and invulnerability timing', () => {
    const resolved = resolvePenaltyActor();
    const projectile = projectileEntities(resolved.session)[0];
    if (projectile === undefined) throw new Error('Expected projectile fixture.');
    const hit = applyGameEvent(definition, resolved.session, collisionEvent(projectile), input);
    expect(hit.session.state.health).toBe(1);
    expect(hit.session.state.invulnerable).toBe(true);
    expect(hit.session.state.playerPhase).toBe('hitstop');
    const ignored = applyGameEvent(definition, hit.session, collisionEvent(projectile), input);
    expect(ignored.session.state.health).toBe(1);
    assertHitLifecycle(projectile.id, ignored.session);
  });

  test('enters game over when configured collision damage reaches zero health', () => {
    const resolved = resolvePenaltyActor();
    const projectile = projectileEntities(resolved.session)[0];
    if (projectile === undefined) throw new Error('Expected projectile fixture.');
    const vulnerable = { ...resolved.session, state: { ...resolved.session.state, health: 1 } };
    const hit = applyGameEvent(definition, vulnerable, collisionEvent(projectile), input);
    expect(hit.session.state.health).toBe(0);
    expect(hit.session.phase).toBe('game-over');
  });
});

/*** Start one deterministic generic arcade fixture session. */
function startGame(seed: number) {
  return applyGameEvent(
    definition,
    createGameSession(definition),
    { type: 'game.start', seed },
    input,
  );
}

/*** Resolve the currently configured non-target actor to create projectiles. */
function resolvePenaltyActor() {
  const started = startGame(0);
  const actor = actorByTag(started.session, 'other');
  return applyGameEvent(definition, started.session, resolveEvent(actor), input);
}

/*** Build one generic actor-resolution event. */
function resolveEvent(actor: GameEntity) {
  return { type: 'actor.resolve', entityId: actor.id } as const;
}

/*** Build one collision event whose measured target is the player. */
function collisionEvent(projectile: GameEntity) {
  return { type: 'collision.enter', entityId: projectile.id, payload: { target: 'player' } } as const;
}

/*** Find one active actor by its caller-owned data tag. */
function actorByTag(session: GameSession, tag: string): GameEntity {
  const actor = Object.values(session.entities).find((entity) => {
    const data = entity.state.data;
    return entity.poolId === 'actors' && isRecord(data) && data.tag === tag;
  });
  if (actor === undefined) throw new Error(`Expected actor tagged ${tag}.`);
  return actor;
}

/*** Read stable caller-owned ids from all active actor data records. */
function actorDataIds(session: GameSession): readonly string[] {
  return Object.values(session.entities).flatMap((entity) => {
    if (entity.poolId !== 'actors' || !isRecord(entity.state.data)) return [];
    const { id } = entity.state.data;
    return typeof id === 'string' ? [id] : [];
  });
}

/*** Select all generic projectile entities from a session. */
function projectileEntities(session: GameSession): readonly GameEntity[] {
  return Object.values(session.entities).filter((entity) => entity.templateId === 'projectile');
}

/*** Verify the timed player feedback and projectile cleanup lifecycle. */
function assertHitLifecycle(projectileId: string, session: GameSession): void {
  const hidden = advanceGameTime(definition, session, 100, input).session;
  expect(hidden.entities[projectileId]).toBeUndefined();
  expect(hidden.state.playerPhase).toBe('hidden');
  const respawning = advanceGameTime(definition, hidden, 200, input).session;
  expect(respawning.state.playerPhase).toBe('respawning');
  const active = advanceGameTime(definition, respawning, 200, input).session;
  expect(active.state.playerPhase).toBe('active');
  const vulnerable = advanceGameTime(definition, active, 300, input).session;
  expect(vulnerable.state.invulnerable).toBe(false);
}

/*** Narrow one serializable value to an object record. */
function isRecord(value: GameValue | undefined): value is GameRecord {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value);
}
