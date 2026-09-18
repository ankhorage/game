import { defineParadoxConfig } from '@ankhorage/paradox';

export default defineParadoxConfig({
  mode: 'write',
  docs: {
    title: '@ankhorage/game',
    description:
      'Platform-neutral config-driven game semantics and runtime primitives for Ankhorage apps.',
    usage: {
      description:
        'Author games as serializable definitions: initialize state and stages, feed platform-neutral events into rules, apply declarative effects, and consume emitted outputs. Pick the example closest to the mechanic you need; combine the same primitives for larger games.',
      entrypoints: [
        'examples/basic-usage/index.ts',
        'examples/entity-pools/index.ts',
        'examples/movement-bounds/index.ts',
        'examples/damage-respawn/index.ts',
        'examples/projectile-collision/index.ts',
        'examples/stage-progression/index.ts',
      ],
    },
  },
  package: {
    root: '.',
    entrypoints: ['src/game.ts'],
  },
  output: { dir: './paradox' },
});
