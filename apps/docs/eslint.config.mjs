import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  // The FFmpeg wasm build (tools/ffmpeg-wasm) is generated Emscripten output, not source.
  { ignores: ['public/ffmpeg/**'] },
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
];
