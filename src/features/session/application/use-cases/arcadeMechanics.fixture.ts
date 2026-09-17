import type { GameEntity, GameRecord, GameSession, GameValue } from '../../../../types/game';
import { applyGameEvent } from './applyGameEvent';
import { createGameSession } from './createGameSession';
import { arcadeDefinition, arcadeInput } from './arcadeMechanics.definition';

/** Start one deterministic generic arcade fixture session. */
export function startArcadeGame(seed: number) {
  return applyGameEvent(
    arcadeDefinition,
    createGameSession(arcadeDefinition),
    { type: 'game.start', seed },
    arcadeInput,
  );
}

/** Resolve the configured non-target actor to create generic projectiles. */
export function resolvePenaltyActor() {
  const started = startArcadeGame(0);
  const actor = actorByTag(started.session, 'other');
  return applyGameEvent(arcadeDefinition, started.session, resolveActorEvent(actor), arcadeInput);
}

/** Build one generic actor-resolution event. */
export function resolveActorEvent(actor: GameEntity) {
  return { type: 'actor.resolve', entityId: actor.id } as const;
}

/** Build one collision event whose measured target is the player. */
export function collisionEvent(projectile: GameEntity) {
  return {
    type: 'collision.enter',
    entityId: projectile.id,
    payload: { target: 'player' },
  } as const;
}

/** Find one active actor by its caller-owned data tag. */
export function actorByTag(session: GameSession, tag: string): GameEntity {
  const actor = Object.values(session.entities).find((entity) => {
    const data = entity.state.data;
    return entity.poolId === 'actors' && isGameRecord(data) && data.tag === tag;
  });
  if (actor === undefined) throw new Error(`Expected actor tagged ${tag}.`);
  return actor;
}

/** Read stable caller-owned ids from all active actor data records. */
export function actorDataIds(session: GameSession): readonly string[] {
  return Object.values(session.entities).flatMap((entity) => {
    const data = entity.state.data;
    if (entity.poolId !== 'actors' || !isGameRecord(data)) return [];
    const { id } = data;
    return typeof id === 'string' ? [id] : [];
  });
}

/** Select all generic projectile entities from a session. */
export function projectileEntities(session: GameSession): readonly GameEntity[] {
  return Object.values(session.entities).filter((entity) => entity.templateId === 'projectile');
}

/** Narrow one serializable value to an object record. */
function isGameRecord(value: GameValue | undefined): value is GameRecord {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}
