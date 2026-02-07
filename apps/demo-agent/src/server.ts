import { createAgent } from '@agent/sdk';
import { createAgentServer } from '@agent/sdk-server';

console.log('Starting demo server...');

const agent = createAgent({
  role: 'coder',
  maxSteps: 5,
  modelName: 'mock-model' // Use mock model for demo
});

// Mock the generate/stream methods for demo purposes if model is not real
agent.generate = async (input) => {
  return { text: 'pong', steps: [] };
};

agent.stream = (input) => {
  return {
    fullStream: (async function* () {
      yield { type: 'text-delta', textDelta: 'Hello ' };
      yield { type: 'text-delta', textDelta: 'World!' };
      yield { type: 'finish', text: 'Hello World!' };
    })(),
    text: Promise.resolve('Hello World!'),
  } as any;
};

const server = createAgentServer({ agent, port: 3001 });
server.start();
console.log('Agent server started on port 3001');
