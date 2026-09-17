import { describe, expect, test } from 'bun:test';

import { applyGameEvent } from './applyGameEvent';
import { arcadeDefinition, arcadeInput } from './arcadeMechanics.definition';
import {
  actorByTag,
  actorDataIds,
  projectileEntities,
  resolveActorEvent,
  startArcadeGame,
} from './arcadeMechanics.fixture';

describe('generic arcade board and progression', () => {
  test('refreshes a board without immediately repeating its current item ids', () => {
    const started = startArcadeGame(0);
    const firstIds = actorDataIds(started.session);
    const refreshed = applyGameEvent(
      arcadeDefinition,
      started.session,
      { type: 'board.refresh', seed: 0.5 },
      arcadeInput,
    );
    const nextIds = actorDataIds(refreshed.session);
    expect(nextIds.every((id) => !firstIds.includes(id))).toBe(true);
  });

  test('handles progress, streak rewards, outputs and completion from rules', () => {
    const started = startArcadeGame(0);
    const target = actorByTag(started.session, 'match');
    const first = applyGameEvent(
      arcadeDefinition,
      started.session,
      resolveActorEvent(target),
      arcadeInput,
    );
    expect(first.outputs[0]?.type).toBe('game.itemResolved');
    expect(first.session.state.progress).toBe(1);

    const second = applyGameEvent(
      arcadeDefinition,
      first.session,
      resolveActorEvent(target),
      arcadeInput,
    );
    expect(second.session.state.health).toBe(4);
    expect(second.session.state.correctStreak).toBe(0);
    expect(second.session.phase).toBe('level-complete');
  });

  test('creates one generic projectile entity per configured text character', () => {
    const started = startArcadeGame(0);
    const penaltyActor = actorByTag(started.session, 'other');
    const resolved = applyGameEvent(
      arcadeDefinition,
      started.session,
      resolveActorEvent(penaltyActor),
      arcadeInput,
    );
    const projectiles = projectileEntities(resolved.session);
    expect(resolved.session.state.health).toBe(2);
    expect(projectiles.map((entity) => entity.state.glyph).sort()).toEqual(['B', 'Y']);
    expect(new Set(projectiles.map((entity) => entity.id)).size).toBe(2);
  });
});
