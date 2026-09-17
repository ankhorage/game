import { describe, expect, test } from 'bun:test';

import type { GameEntity, GameSession } from '../../../../types/game';
import { advanceGameTime } from './advanceGameTime';
import { applyGameEvent } from './applyGameEvent';
import { arcadeDefinition, arcadeInput } from './arcadeMechanics.definition';
import {
  collisionEvent,
  projectileEntities,
  resolvePenaltyActor,
} from './arcadeMechanics.fixture';

describe('generic arcade collision and lifecycle', () => {
  test('applies collision damage once and drives hitstop, respawn and invulnerability timing', () => {
    const resolved = resolvePenaltyActor();
    const [projectile] = projectileEntities(resolved.session);
    if (projectile === undefined) throw new Error('Expected projectile fixture.');

    const hit = applyGameEvent(
      arcadeDefinition,
      resolved.session,
      collisionEvent(projectile),
      arcadeInput,
    );
    expect(hit.session.state.health).toBe(1);
    expect(hit.session.state.invulnerable).toBe(true);
    expect(hit.session.state.playerPhase).toBe('hitstop');

    const ignored = applyGameEvent(
      arcadeDefinition,
      hit.session,
      collisionEvent(projectile),
      arcadeInput,
    );
    expect(ignored.session.state.health).toBe(1);
    assertHitLifecycle(projectile, ignored.session);
  });

  test('enters game over when configured collision damage reaches zero health', () => {
    const resolved = resolvePenaltyActor();
    const [projectile] = projectileEntities(resolved.session);
    if (projectile === undefined) throw new Error('Expected projectile fixture.');

    const vulnerable = {
      ...resolved.session,
      state: { ...resolved.session.state, health: 1 },
    };
    const hit = applyGameEvent(
      arcadeDefinition,
      vulnerable,
      collisionEvent(projectile),
      arcadeInput,
    );
    expect(hit.session.state.health).toBe(0);
    expect(hit.session.phase).toBe('game-over');
  });
});

/** Verify timed feedback, entity cleanup and invulnerability lifecycle. */
function assertHitLifecycle(projectile: GameEntity, session: GameSession): void {
  const hidden = advanceGameTime(arcadeDefinition, session, 100, arcadeInput).session;
  expect(Object.values(hidden.entities).some((entity) => entity.id === projectile.id)).toBe(false);
  expect(hidden.state.playerPhase).toBe('hidden');

  const respawning = advanceGameTime(arcadeDefinition, hidden, 200, arcadeInput).session;
  expect(respawning.state.playerPhase).toBe('respawning');

  const active = advanceGameTime(arcadeDefinition, respawning, 200, arcadeInput).session;
  expect(active.state.playerPhase).toBe('active');

  const vulnerable = advanceGameTime(arcadeDefinition, active, 300, arcadeInput).session;
  expect(vulnerable.state.invulnerable).toBe(false);
}
