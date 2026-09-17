import { defineParadoxConfig } from '@ankhorage/paradox';
export default defineParadoxConfig({ mode: 'write', docs: { title: '@ankhorage/game', description: 'Platform-neutral config-driven game semantics and runtime primitives for Ankhorage apps.' }, package: { root: '.', entrypoints: ['src/game.ts'] }, output: { dir: './paradox' } });
