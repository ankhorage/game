import { describe, expect, test } from 'bun:test';
import type { GameDefinition, GameInput } from '../../../../types/game';
import { advanceGameTime } from './advanceGameTime';
import { applyGameEvent } from './applyGameEvent';
import { createGameSession } from './createGameSession';

const ref = (source: 'entity' | 'event' | 'input' | 'local' | 'session' | 'state', path?: string) => ({ kind: 'reference', source, path }) as const;
const literal = (value: boolean | null | number | string) => ({ kind: 'literal', value }) as const;

const definition: GameDefinition = {
  id: 'generic-collector',
  initialState: { player: { x: 50, minX: 10, maxX: 90 }, health: 3, progress: 0, resolvedIds: [] },
  stages: [
    { id: 'stage-one', initialState: { targetTag: 'target' }, nextStageId: 'stage-two' },
    { id: 'stage-two', initialState: { targetTag: 'bonus', progress: 0 } },
  ],
  entityTemplates: [{ id: 'token' }, { id: 'projectile' }],
  pools: [{
    id: 'tokens',
    source: ref('input', 'items'),
    entityTemplateId: 'token',
    size: 3,
    selectors: [
      { count: 1, where: { kind: 'equals', left: ref('local', 'item.tag'), right: ref('state', 'targetTag') } },
      { count: 2 },
    ],
    placement: { xStatePath: 'x', yStatePath: 'y', xMin: 10, xMax: 90, yMin: 10, yMax: 60, minimumDistance: 8 },
  }],
  rules: [
    { id: 'start-board', event: 'game.start', effects: [{ kind: 'refreshPool', poolId: 'tokens', seed: ref('event', 'seed') }] },
    { id: 'move-player', event: 'player.move', effects: [{ kind: 'set', path: 'player.x', value: { kind: 'clamp', value: ref('event', 'x'), min: ref('state', 'player.minX'), max: ref('state', 'player.maxX') } }] },
    { id: 'resolve-target', event: 'entity.resolve', when: { kind: 'equals', left: ref('entity', 'data.tag'), right: ref('state', 'targetTag') }, effects: [
      { kind: 'increment', path: 'progress', value: literal(1) },
      { kind: 'emit', type: 'game.itemResolved', payload: { itemId: ref('entity', 'data.id') } },
      { kind: 'schedule', delayMs: literal(500), effects: [{ kind: 'emit', type: 'game.resolutionFinished' }] },
    ] },
    { id: 'damage', event: 'player.hit', effects: [{ kind: 'increment', path: 'health', value: literal(-1), min: literal(0) }] },
    { id: 'complete-stage', event: 'stage.complete', effects: [{ kind: 'transitionStage' }] },
    { id: 'restart-stage', event: 'stage.restart', effects: [{ kind: 'restartStage' }] },
  ],
};

const input: GameInput = { items: [{ id: 'a', tag: 'target' }, { id: 'b', tag: 'other' }, { id: 'c', tag: 'other' }, { id: 'd', tag: 'target' }] };

describe('config-driven game runtime', () => {
  test('creates a session and clamps configured movement from an event', () => {
    const moved = applyGameEvent(definition, createGameSession(definition), { type: 'player.move', payload: { x: 120 } });
    expect(moved.session.state.player).toEqual({ x: 90, minX: 10, maxX: 90 });
  });

  test('refreshes a generic entity pool from caller-owned input data', () => {
    const started = applyGameEvent(definition, createGameSession(definition), { type: 'game.start', payload: { seed: 0.25 }, seed: 0.25 }, input);
    const entities = Object.values(started.session.entities);
    expect(entities).toHaveLength(3);
    const coordinates = entities.map((entity) => [entity.state.x, entity.state.y]);
    expect(new Set(coordinates.map((coordinate) => coordinate.join(':'))).size).toBe(3);
  });

  test('emits app-domain outputs and represents delays without platform timers', () => {
    const started = applyGameEvent(definition, createGameSession(definition), { type: 'game.start', payload: { seed: 0 }, seed: 0 }, input);
    const target = Object.values(started.session.entities).find((entity) => typeof entity.state.data === 'object' && entity.state.data !== null && !Array.isArray(entity.state.data) && entity.state.data.tag === 'target');
    expect(target).toBeDefined();
    if (target === undefined) return;
    const resolved = applyGameEvent(definition, started.session, { type: 'entity.resolve', entityId: target.id }, input);
    expect(resolved.session.state.progress).toBe(1);
    expect(resolved.session.scheduled).toHaveLength(1);
    const beforeDue = advanceGameTime(definition, resolved.session, 499, input);
    expect(beforeDue.outputs).toEqual([]);
    const due = advanceGameTime(definition, beforeDue.session, 1, input);
    expect(due.outputs).toEqual([{ type: 'game.resolutionFinished', payload: {} }]);
  });

  test('applies health bounds and stage lifecycle from config', () => {
    const firstHit = applyGameEvent(definition, createGameSession(definition), { type: 'player.hit' });
    expect(firstHit.session.state.health).toBe(2);
    const advanced = applyGameEvent(definition, firstHit.session, { type: 'stage.complete' });
    expect(advanced.session.stageId).toBe('stage-two');
    expect(advanced.session.state.targetTag).toBe('bonus');
    const restarted = applyGameEvent(definition, advanced.session, { type: 'stage.restart' });
    expect(restarted.session.stageId).toBe('stage-two');
  });
});
