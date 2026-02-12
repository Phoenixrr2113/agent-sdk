import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://phoenixrr2113.github.io',
  base: '/agntk',
  integrations: [
    starlight({
      title: 'Agent SDK',
      description: 'A modular AI agent framework built on Vercel AI SDK',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: false,
      },
      customCss: [
        '@fontsource-variable/inter',
        '@fontsource/jetbrains-mono/400.css',
        '@fontsource/jetbrains-mono/500.css',
        '@fontsource/jetbrains-mono/600.css',
        './src/styles/custom.css',
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Phoenixrr2113/agntk' },
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
            { label: 'CLI', link: '/packages/cli' },
            { label: 'SDK Server', link: '/packages/sdk-server' },
            { label: 'SDK Client', link: '/packages/sdk-client' },
            { label: 'Logger', link: '/packages/logger' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'Config System', link: '/configuration/yaml-config' },
          ],
        },
      ],
    }),
  ],
});

