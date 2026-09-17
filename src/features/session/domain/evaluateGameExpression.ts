import type {
  GameEntity,
  GameEvent,
  GameExpression,
  GameInput,
  GameRecord,
  GameReferenceSource,
  GameSession,
  GameValue,
} from '../../../types/game';
import { readGamePath } from '../utils/gamePath';

/*** Resolve one serializable expression against explicit runtime context. */
export function evaluateGameExpression(
  expression: GameExpression,
  context: GameExpressionContext,
): GameValue {
  switch (expression.kind) {
    case 'literal':
      return expression.value;
    case 'reference':
      return resolveReference(expression.source, expression.path, context);
    case 'math':
      return evaluateMath(expression.operator, expression.values, context);
    case 'clamp':
      return Math.min(
        numberValue(evaluateGameExpression(expression.max, context)),
        Math.max(
          numberValue(evaluateGameExpression(expression.min, context)),
          numberValue(evaluateGameExpression(expression.value, context)),
        ),
      );
    case 'split':
      return splitValue(expression.value, expression.separator, context);
    case 'join':
      return expression.values
        .map((value) => stringValue(evaluateGameExpression(value, context)))
        .join(expression.separator ?? '');
    case 'entities':
      return entityValues(context.session, expression.poolId);
  }
}

export interface GameExpressionContext {
  readonly session: GameSession;
  readonly input: GameInput;
  readonly event?: GameEvent;
  readonly entity?: GameEntity;
  readonly local?: GameRecord;
}

/*** Resolve one reference source and optional dot-separated path. */
function resolveReference(
  source: GameReferenceSource,
  path: string | undefined,
  context: GameExpressionContext,
): GameValue {
  const sourceValue = referenceRoot(source, context);
  const value = readGamePath(sourceValue, path);
  if (value === undefined) {
    throw new Error(`Game reference ${source}:${path ?? '<root>'} is undefined.`);
  }
  return value;
}

/*** Build the serializable root value for one supported reference source. */
function referenceRoot(
  source: GameReferenceSource,
  context: GameExpressionContext,
): GameValue | undefined {
  if (source === 'state') return context.session.state;
  if (source === 'input') return context.input;
  if (source === 'local') return context.local;
  if (source === 'entity') return context.entity === undefined ? undefined : entityValue(context.entity);
  if (source === 'event') return context.event === undefined ? undefined : eventValue(context.event);
  return {
    elapsedMs: context.session.elapsedMs,
    phase: context.session.phase,
    sequence: context.session.sequence,
    stageId: context.session.stageId,
  };
}

/*** Expose one entity as serializable state plus stable runtime metadata. */
function entityValue(entity: GameEntity): GameRecord {
  return {
    ...entity.state,
    id: entity.id,
    templateId: entity.templateId,
    ...(entity.poolId === undefined ? {} : { poolId: entity.poolId }),
  };
}

/*** Expose one event payload together with stable event metadata. */
function eventValue(event: GameEvent): GameRecord {
  return {
    ...(event.payload ?? {}),
    type: event.type,
    ...(event.entityId === undefined ? {} : { entityId: event.entityId }),
    ...(event.seed === undefined ? {} : { seed: event.seed }),
  };
}

/*** Resolve current entities as serializable snapshots, optionally filtered by pool. */
function entityValues(session: GameSession, poolId: string | undefined): readonly GameValue[] {
  return Object.values(session.entities)
    .filter((entity) => poolId === undefined || entity.poolId === poolId)
    .map(entityValue);
}

/*** Split one string-valued expression into serializable items. */
function splitValue(
  expression: GameExpression,
  separator: string,
  context: GameExpressionContext,
): readonly string[] {
  const value = evaluateGameExpression(expression, context);
  if (typeof value !== 'string') throw new Error('split expression requires a string value.');
  return value.split(separator);
}

/*** Convert one serializable scalar into a deterministic joined string part. */
function stringValue(value: GameValue): string {
  if (typeof value === 'object' && value !== null) {
    throw new Error('join expression accepts only scalar values.');
  }
  return String(value);
}

/*** Evaluate one numeric expression operator without hidden coercion. */
function evaluateMath(
  operator: 'add' | 'divide' | 'max' | 'min' | 'multiply' | 'subtract',
  expressions: readonly GameExpression[],
  context: GameExpressionContext,
): number {
  const values = expressions.map((expression) =>
    numberValue(evaluateGameExpression(expression, context)),
  );
  if (values.length === 0) {
    throw new Error(`Math operator ${operator} requires at least one value.`);
  }
  if (operator === 'add') return values.reduce((total, value) => total + value, 0);
  if (operator === 'multiply') return values.reduce((total, value) => total * value, 1);
  if (operator === 'min') return Math.min(...values);
  if (operator === 'max') return Math.max(...values);
  const [first, ...rest] = values;
  if (first === undefined) throw new Error(`Math operator ${operator} requires a first value.`);
  if (operator === 'subtract') return rest.reduce((result, value) => result - value, first);
  return rest.reduce((result, value) => result / value, first);
}

/*** Require one evaluated value to be a finite number. */
function numberValue(value: GameValue): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Game numeric expression resolved to a non-finite number.');
  }
  return value;
}
