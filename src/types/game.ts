export type GamePrimitive = boolean | null | number | string;

export type GameValue =
  GamePrimitive | readonly GameValue[] | { readonly [key: string]: GameValue };

export type GameRecord = Readonly<Record<string, GameValue>>;
export type GameReferenceSource = 'entity' | 'event' | 'input' | 'local' | 'session' | 'state';

export type GameExpression =
  | { readonly kind: 'literal'; readonly value: GameValue }
  | { readonly kind: 'reference'; readonly source: GameReferenceSource; readonly path?: string }
  | {
      readonly kind: 'math';
      readonly operator: 'add' | 'divide' | 'max' | 'min' | 'multiply' | 'subtract';
      readonly values: readonly GameExpression[];
    }
  | {
      readonly kind: 'clamp';
      readonly value: GameExpression;
      readonly min: GameExpression;
      readonly max: GameExpression;
    }
  | { readonly kind: 'split'; readonly value: GameExpression; readonly separator: string };

export type GameCondition =
  | {
      readonly kind:
        | 'equals'
        | 'greaterThan'
        | 'greaterThanOrEqual'
        | 'includes'
        | 'lessThan'
        | 'lessThanOrEqual'
        | 'notEquals';
      readonly left: GameExpression;
      readonly right: GameExpression;
    }
  | { readonly kind: 'truthy'; readonly value: GameExpression }
  | { readonly kind: 'all' | 'any'; readonly conditions: readonly GameCondition[] }
  | { readonly kind: 'not'; readonly condition: GameCondition };

export interface GameEntityTemplate {
  readonly id: string;
  readonly initialState?: GameRecord;
}

export interface GamePoolSelector {
  readonly count: number;
  readonly where?: GameCondition;
}

export interface GamePoolPlacement {
  readonly xStatePath: string;
  readonly yStatePath: string;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly minimumDistance?: number;
}

export interface GameEntityPoolDefinition {
  readonly id: string;
  readonly source: GameExpression;
  readonly entityTemplateId: string;
  readonly size: number;
  readonly selectors: readonly GamePoolSelector[];
  readonly idPath?: string;
  readonly excludeIdsFromStatePaths?: readonly string[];
  readonly entityState?: Readonly<Record<string, GameExpression>>;
  readonly placement?: GamePoolPlacement;
}

export type GameEffect =
  | { readonly kind: 'set'; readonly path: string; readonly value: GameExpression }
  | {
      readonly kind: 'increment';
      readonly path: string;
      readonly value: GameExpression;
      readonly min?: GameExpression;
      readonly max?: GameExpression;
    }
  | { readonly kind: 'setPhase'; readonly phase: GameExpression }
  | {
      readonly kind: 'emit';
      readonly type: string;
      readonly payload?: Readonly<Record<string, GameExpression>>;
    }
  | {
      readonly kind: 'schedule';
      readonly delayMs: GameExpression;
      readonly effects: readonly GameEffect[];
    }
  | { readonly kind: 'refreshPool'; readonly poolId: string; readonly seed?: GameExpression }
  | {
      readonly kind: 'spawnEntity';
      readonly templateId: string;
      readonly id: GameExpression;
      readonly state?: Readonly<Record<string, GameExpression>>;
    }
  | { readonly kind: 'removeEntity'; readonly entityId: GameExpression }
  | {
      readonly kind: 'forEach';
      readonly source: GameExpression;
      readonly effects: readonly GameEffect[];
    }
  | {
      readonly kind: 'transitionStage';
      readonly stageId?: GameExpression;
      readonly clearEntities?: boolean;
    }
  | { readonly kind: 'restartStage'; readonly clearEntities?: boolean };

export interface GameRuleDefinition {
  readonly id: string;
  readonly event: string;
  readonly when?: GameCondition;
  readonly effects: readonly GameEffect[];
}

export interface GameStageDefinition {
  readonly id: string;
  readonly initialState?: GameRecord;
  readonly nextStageId?: string;
}

export interface GameDefinition {
  readonly id: string;
  readonly initialPhase?: string;
  readonly initialState?: GameRecord;
  readonly stages: readonly GameStageDefinition[];
  readonly entityTemplates?: readonly GameEntityTemplate[];
  readonly pools?: readonly GameEntityPoolDefinition[];
  readonly rules: readonly GameRuleDefinition[];
}

export interface GameEntity {
  readonly id: string;
  readonly templateId: string;
  readonly poolId?: string;
  readonly state: GameRecord;
}

export interface GameScheduledEffects {
  readonly id: number;
  readonly remainingMs: number;
  readonly effects: readonly GameEffect[];
  readonly context: GameExecutionContextSnapshot;
}

export interface GameSession {
  readonly definitionId: string;
  readonly stageId: string;
  readonly phase: string;
  readonly state: GameRecord;
  readonly entities: Readonly<Record<string, GameEntity>>;
  readonly scheduled: readonly GameScheduledEffects[];
  readonly elapsedMs: number;
  readonly sequence: number;
}

export interface GameEvent {
  readonly type: string;
  readonly entityId?: string;
  readonly payload?: GameRecord;
  readonly seed?: number;
}

export interface GameOutput {
  readonly type: string;
  readonly payload: GameRecord;
}

export interface GameExecutionResult {
  readonly session: GameSession;
  readonly outputs: readonly GameOutput[];
}

export interface GameExecutionContextSnapshot {
  readonly event?: GameEvent;
  readonly entityId?: string;
  readonly local?: GameRecord;
}

export type GameInput = GameRecord;
