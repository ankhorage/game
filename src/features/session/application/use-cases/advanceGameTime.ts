import type { GameDefinition, GameExecutionResult, GameInput, GameScheduledEffects, GameSession } from '../../../../types/game';
import { applyGameEffects } from '../../domain/applyGameEffects';

/*** Advance explicit elapsed time and execute due scheduled game effects without owning a timer. */
export function advanceGameTime(definition: GameDefinition, session: GameSession, elapsedMs: number, input: GameInput = {}): GameExecutionResult {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Game elapsed time must be a non-negative finite number.');
  const advanced = { ...session, elapsedMs: session.elapsedMs + elapsedMs, scheduled: session.scheduled.map((scheduled) => ({ ...scheduled, remainingMs: scheduled.remainingMs - elapsedMs })).filter((scheduled) => scheduled.remainingMs > 0) };
  const due = session.scheduled.map((scheduled) => ({ ...scheduled, remainingMs: scheduled.remainingMs - elapsedMs })).filter((scheduled) => scheduled.remainingMs <= 0).sort((left, right) => left.id - right.id);
  return due.reduce<GameExecutionResult>((result, scheduled) => executeScheduled(definition, result, scheduled, input), { session: advanced, outputs: [] });
}

/*** Apply one due scheduled effect group and append its outputs. */
function executeScheduled(definition: GameDefinition, result: GameExecutionResult, scheduled: GameScheduledEffects, input: GameInput): GameExecutionResult {
  const applied = applyGameEffects(definition, result.session, scheduled.effects, input, scheduled.context);
  return { session: applied.session, outputs: [...result.outputs, ...applied.outputs] };
}
