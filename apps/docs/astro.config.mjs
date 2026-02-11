import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Agent SDK',
      description: 'A modular AI agent framework built on Vercel AI SDK',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Phoenixrr2113/agent-sdk' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', link: '/getting-started/introduction' },
            { label: 'Installation', link: '/getting-started/installation' },
            { label: 'Quick Start', link: '/getting-started/quick-start' },
          ],
        },
        {
          label: 'Packages',
          items: [
            { label: 'SDK Core', link: '/packages/sdk' },
            { label: 'SDK Server', link: '/packages/sdk-server' },
            { label: 'SDK Client', link: '/packages/sdk-client' },
            { label: 'Logger', link: '/packages/logger' },
            { label: 'Brain', link: '/packages/brain' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'YAML Config System', link: '/configuration/yaml-config' },
          ],
        },
      ],
    }),
  ],
});

