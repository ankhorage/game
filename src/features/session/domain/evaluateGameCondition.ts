import type { GameCondition, GameValue } from '../../../types/game';
import { evaluateGameExpression, type GameExpressionContext } from './evaluateGameExpression';

/*** Evaluate one declarative game condition against explicit runtime context. */
export function evaluateGameCondition(
  condition: GameCondition,
  context: GameExpressionContext,
): boolean {
  switch (condition.kind) {
    case 'all':
      return condition.conditions.every((candidate) => evaluateGameCondition(candidate, context));
    case 'any':
      return condition.conditions.some((candidate) => evaluateGameCondition(candidate, context));
    case 'not':
      return !evaluateGameCondition(condition.condition, context);
    case 'truthy':
      return Boolean(evaluateGameExpression(condition.value, context));
    default: {
      const left = evaluateGameExpression(condition.left, context);
      const right = evaluateGameExpression(condition.right, context);
      if (condition.kind === 'equals') return deepEquals(left, right);
      if (condition.kind === 'notEquals') return !deepEquals(left, right);
      if (condition.kind === 'includes') return includesValue(left, right);
      const [leftNumber, rightNumber] = numericPair(left, right);
      if (condition.kind === 'greaterThan') return leftNumber > rightNumber;
      if (condition.kind === 'greaterThanOrEqual') return leftNumber >= rightNumber;
      if (condition.kind === 'lessThan') return leftNumber < rightNumber;
      return leftNumber <= rightNumber;
    }
  }
}

/*** Compare serializable values structurally for deterministic rule checks. */
function deepEquals(left: GameValue, right: GameValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/*** Check membership for arrays or substring presence for strings. */
function includesValue(container: GameValue, value: GameValue): boolean {
  if (typeof container === 'string' && typeof value === 'string') return container.includes(value);
  if (!Array.isArray(container)) return false;
  return container.some((candidate: GameValue) => deepEquals(candidate, value));
}

/*** Require both compared values to be finite numbers. */
function numericPair(left: GameValue, right: GameValue): readonly [number, number] {
  if (
    typeof left !== 'number' ||
    typeof right !== 'number' ||
    !Number.isFinite(left) ||
    !Number.isFinite(right)
  ) {
    throw new Error('Numeric game condition requires two finite numbers.');
  }
  return [left, right];
}
