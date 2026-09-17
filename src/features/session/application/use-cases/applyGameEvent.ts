import type {
  GameDefinition,
  GameEvent,
  GameExecutionResult,
  GameInput,
  GameSession,
} from '../../../../types/game';
import { applyGameEffects } from '../../domain/applyGameEffects';
import { evaluateGameCondition } from '../../domain/evaluateGameCondition';

/*** Apply every matching declarative rule for one explicit game event. */
export function applyGameEvent(
  definition: GameDefinition,
  session: GameSession,
  event: GameEvent,
  input: GameInput = {},
): GameExecutionResult {
  if (session.definitionId !== definition.id) {
    throw new Error(`Session belongs to ${session.definitionId}, not ${definition.id}.`);
  }
  const entity = event.entityId === undefined ? undefined : session.entities[event.entityId];
  return definition.rules
    .filter((rule) => rule.event === event.type)
    .reduce<GameExecutionResult>(
      (result, rule) => {
        const currentEntity =
          event.entityId === undefined ? undefined : result.session.entities[event.entityId];
        const ruleEntity = currentEntity ?? entity;
        const conditionContext = {
          session: result.session,
          input,
          event,
          ...(ruleEntity === undefined ? {} : { entity: ruleEntity }),
        };
        const matches =
          rule.when === undefined || evaluateGameCondition(rule.when, conditionContext);
        if (!matches) return result;
        const applied = applyGameEffects(definition, result.session, rule.effects, input, {
          event,
          ...(event.entityId === undefined ? {} : { entityId: event.entityId }),
        });
        return { session: applied.session, outputs: [...result.outputs, ...applied.outputs] };
      },
      { session, outputs: [] },
    );
}
