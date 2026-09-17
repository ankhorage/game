import { createKnipConfig } from '@ankhorage/devtools/knip';
export default createKnipConfig({ entry: ['src/game.ts', 'src/types/public.ts', 'examples/**/*.ts', 'paradox.config.ts', 'eslint.config.mjs', 'eslint.examples.config.mjs', 'eslint.local.config.mjs', '.prettierrc.js', 'prettier.local.config.js'] });
