import type { Preview } from '@storybook/nextjs-vite';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { Providers } from '../src/app/providers';
import { handlers } from '../storybook/handlers';
import '../src/app/globals.css';

const preview: Preview = {
  loaders: [mswLoader(async () => {
    const worker = setupWorker(http.all('/api/*', () => HttpResponse.json({ error: { code: 'storybook_unmocked_request' } }, { status: 501 })));
    await worker.start({ quiet: true, onUnhandledRequest: 'bypass' });
    return worker;
  })],
  decorators: [(Story, { id }) => <Providers key={id}><Story /></Providers>],
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    msw: { handlers },
    options: { storySort: { order: ['Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages'] } },
    viewport: {
      options: {
        desktop: { name: 'Desktop · 1440px', styles: { width: '1440px', height: '900px' } },
        tablet: { name: 'Tablet · 1024px', styles: { width: '1024px', height: '900px' } },
        mobile: { name: 'Mobile · 390px', styles: { width: '390px', height: '844px' } },
        narrow: { name: 'Mobile · 320px', styles: { width: '320px', height: '640px' } },
      },
    },
  },
};

export default preview;
