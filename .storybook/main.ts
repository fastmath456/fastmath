import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: ['../storybook/**/*.stories.tsx'],
  staticDirs: ['../public', { from: '../node_modules/msw/lib/mockServiceWorker.js', to: '/mockServiceWorker.js' }],
  features: { experimentalRSC: true },
  viteFinal: config => mergeConfig(config, {
    publicDir: false,
    resolve: {
      alias: [{ find: /^@\/server$/, replacement: fileURLToPath(new URL('./server.mock.ts', import.meta.url)) }],
    },
  }),
};

export default config;
