module.exports = [
  {
    path: 'packages/sdk/dist/index.js',
    limit: '100 KB',
    name: '@agntk/core',
    import: '{ AgentSDK }',
  },
  {
    path: 'packages/sdk-server/dist/index.js',
    limit: '100 KB',
    name: '@agntk/server',
    import: '{ createServer }',
  },
  {
    path: 'packages/sdk-client/dist/index.js',
    limit: '100 KB',
    name: '@agntk/client',
    import: '{ SDKClient }',
  },
  {
    path: 'packages/logger/dist/index.js',
    limit: '100 KB',
    name: '@agntk/logger',
    import: '{ Logger }',
  },
];

