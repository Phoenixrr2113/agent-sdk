module.exports = [
  {
    path: 'packages/sdk/dist/index.js',
    limit: '100 KB',
    name: '@agent/sdk',
    import: '{ AgentSDK }',
  },
  {
    path: 'packages/sdk-server/dist/index.js',
    limit: '100 KB',
    name: '@agent/sdk-server',
    import: '{ createServer }',
  },
  {
    path: 'packages/sdk-client/dist/index.js',
    limit: '100 KB',
    name: '@agent/sdk-client',
    import: '{ SDKClient }',
  },
  {
    path: 'packages/logger/dist/index.js',
    limit: '100 KB',
    name: '@agent/logger',
    import: '{ Logger }',
  },
];

