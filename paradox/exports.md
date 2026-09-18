# Public API

## advanceGameTime

Kind: `function`
Module: `src/features/session/application/use-cases/advanceGameTime.ts`
Source: `src/features/session/application/use-cases/advanceGameTime.ts:11:1`

Advance explicit elapsed time and execute due scheduled game effects without owning a timer.

### Signatures

- `(definition: GameDefinition, session: GameSession, elapsedMs: number, input?: Readonly<Record<string, import("../../../../game").GameValue>>) => GameExecutionResult`
  - definition: `GameDefinition`
  - elapsedMs: `number`
  - input: `Readonly<Record<string, import("../../../../game").GameValue>>` (optional)
  - session: `GameSession`
  - returns: `GameExecutionResult`

## applyGameEvent

Kind: `function`
Module: `src/features/session/application/use-cases/applyGameEvent.ts`
Source: `src/features/session/application/use-cases/applyGameEvent.ts:12:1`

Apply every matching declarative rule for one explicit game event.

### Signatures

- `(definition: GameDefinition, session: GameSession, event: GameEvent, input?: Readonly<Record<string, import("../../../../game").GameValue>>) => GameExecutionResult`
  - definition: `GameDefinition`
  - event: `GameEvent`
  - input: `Readonly<Record<string, import("../../../../game").GameValue>>` (optional)
  - session: `GameSession`
  - returns: `GameExecutionResult`

## createGameSession

Kind: `function`
Module: `src/features/session/application/use-cases/createGameSession.ts`
Source: `src/features/session/application/use-cases/createGameSession.ts:10:1`

Create and initialize one deterministic platform-neutral game session.

### Signatures

- `(definition: GameDefinition, initialization?: GameSessionInitialization) => GameExecutionResult`
  - definition: `GameDefinition`
  - initialization: `GameSessionInitialization` (optional)
  - returns: `GameExecutionResult`

## GameCondition

Kind: `unknown`
Module: `src/types/game.ts`
Source: `src/types/game.ts:31:1`

## GameDefinition

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:139:1`

### Members

| Name            | Kind     | Type                                  | Required | Description |
| --------------- | -------- | ------------------------------------- | -------- | ----------- |
| entityTemplates | property | `readonly GameEntityTemplate[]`       | no       |             |
| id              | property | `string`                              | yes      |             |
| initialPhase    | property | `string`                              | no       |             |
| initialState    | property | `Readonly<Record<string, GameValue>>` | no       |             |
| pools           | property | `readonly GameEntityPoolDefinition[]` | no       |             |
| rules           | property | `readonly GameRuleDefinition[]`       | yes      |             |
| stages          | property | `readonly GameStageDefinition[]`      | yes      |             |

## GameEffect

Kind: `unknown`
Module: `src/types/game.ts`
Source: `src/types/game.ts:80:1`

## GameEntity

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:149:1`

### Members

| Name       | Kind     | Type                                  | Required | Description |
| ---------- | -------- | ------------------------------------- | -------- | ----------- |
| id         | property | `string`                              | yes      |             |
| poolId     | property | `string`                              | no       |             |
| state      | property | `Readonly<Record<string, GameValue>>` | yes      |             |
| templateId | property | `string`                              | yes      |             |

## GameEntityPoolDefinition

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:68:1`

### Members

| Name                     | Kind     | Type                                       | Required | Description |
| ------------------------ | -------- | ------------------------------------------ | -------- | ----------- |
| entityState              | property | `Readonly<Record<string, GameExpression>>` | no       |             |
| entityTemplateId         | property | `string`                                   | yes      |             |
| excludeIdsFromStatePaths | property | `readonly string[]`                        | no       |             |
| id                       | property | `string`                                   | yes      |             |
| idPath                   | property | `string`                                   | no       |             |
| placement                | property | `GamePoolPlacement`                        | no       |             |
| selectors                | property | `readonly GamePoolSelector[]`              | yes      |             |
| size                     | property | `number`                                   | yes      |             |
| source                   | property | `GameExpression`                           | yes      |             |

## GameEntityTemplate

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:48:1`

### Members

| Name         | Kind     | Type                                  | Required | Description |
| ------------ | -------- | ------------------------------------- | -------- | ----------- |
| id           | property | `string`                              | yes      |             |
| initialState | property | `Readonly<Record<string, GameValue>>` | no       |             |

## GameEvent

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:179:1`

### Members

| Name     | Kind     | Type                                  | Required | Description |
| -------- | -------- | ------------------------------------- | -------- | ----------- |
| entityId | property | `string`                              | no       |             |
| payload  | property | `Readonly<Record<string, GameValue>>` | no       |             |
| seed     | property | `number`                              | no       |             |
| type     | property | `string`                              | yes      |             |

## GameExecutionResult

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:191:1`

### Members

| Name    | Kind     | Type                    | Required | Description |
| ------- | -------- | ----------------------- | -------- | ----------- |
| outputs | property | `readonly GameOutput[]` | yes      |             |
| session | property | `GameSession`           | yes      |             |

## GameExpression

Kind: `unknown`
Module: `src/types/game.ts`
Source: `src/types/game.ts:9:1`

## GameInput

Kind: `unknown`
Module: `src/types/game.ts`
Source: `src/types/game.ts:202:1`

## GameOutput

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:186:1`

### Members

| Name    | Kind     | Type                                  | Required | Description |
| ------- | -------- | ------------------------------------- | -------- | ----------- |
| payload | property | `Readonly<Record<string, GameValue>>` | yes      |             |
| type    | property | `string`                              | yes      |             |

## GamePoolPlacement

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:58:1`

### Members

| Name            | Kind     | Type     | Required | Description |
| --------------- | -------- | -------- | -------- | ----------- |
| minimumDistance | property | `number` | no       |             |
| xMax            | property | `number` | yes      |             |
| xMin            | property | `number` | yes      |             |
| xStatePath      | property | `string` | yes      |             |
| yMax            | property | `number` | yes      |             |
| yMin            | property | `number` | yes      |             |
| yStatePath      | property | `string` | yes      |             |

## GamePoolSelector

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:53:1`

### Members

| Name  | Kind     | Type            | Required | Description |
| ----- | -------- | --------------- | -------- | ----------- |
| count | property | `number`        | yes      |             |
| where | property | `GameCondition` | no       |             |

## GameRecord

Kind: `unknown`
Module: `src/types/game.ts`
Source: `src/types/game.ts:6:1`

## GameRuleDefinition

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:126:1`

### Members

| Name    | Kind     | Type                    | Required | Description |
| ------- | -------- | ----------------------- | -------- | ----------- |
| effects | property | `readonly GameEffect[]` | yes      |             |
| event   | property | `string`                | yes      |             |
| id      | property | `string`                | yes      |             |
| when    | property | `GameCondition`         | no       |             |

## GameSession

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:168:1`

### Members

| Name         | Kind     | Type                                   | Required | Description |
| ------------ | -------- | -------------------------------------- | -------- | ----------- |
| definitionId | property | `string`                               | yes      |             |
| elapsedMs    | property | `number`                               | yes      |             |
| entities     | property | `Readonly<Record<string, GameEntity>>` | yes      |             |
| phase        | property | `string`                               | yes      |             |
| scheduled    | property | `readonly GameScheduledEffects[]`      | yes      |             |
| sequence     | property | `number`                               | yes      |             |
| stageId      | property | `string`                               | yes      |             |
| state        | property | `Readonly<Record<string, GameValue>>`  | yes      |             |

## GameSessionInitialization

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:163:1`

### Members

| Name  | Kind     | Type                                  | Required | Description |
| ----- | -------- | ------------------------------------- | -------- | ----------- |
| input | property | `Readonly<Record<string, GameValue>>` | no       |             |
| seed  | property | `number`                              | no       |             |

## GameStageDefinition

Kind: `type`
Module: `src/types/game.ts`
Source: `src/types/game.ts:133:1`

### Members

| Name         | Kind     | Type                                  | Required | Description |
| ------------ | -------- | ------------------------------------- | -------- | ----------- |
| id           | property | `string`                              | yes      |             |
| initialState | property | `Readonly<Record<string, GameValue>>` | no       |             |
| nextStageId  | property | `string`                              | no       |             |

## GameValue

Kind: `unknown`
Module: `src/types/game.ts`
Source: `src/types/game.ts:3:1`
