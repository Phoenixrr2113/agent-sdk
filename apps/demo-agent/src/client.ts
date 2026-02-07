import { AgentHttpClient, ChatClient } from '@agent/sdk-client';

const http = new AgentHttpClient('http://localhost:3001');
const chat = new ChatClient(http);

console.log('Connecting to agent server...');

// Add a slight delay to ensure server is ready
await new Promise(resolve => setTimeout(resolve, 1000));

try {
  await chat.stream(
    { messages: [{ role: 'user', content: 'Say hello' }] },
    {
      onTextDelta: (text) => process.stdout.write(text),
      onComplete: (result) => console.log('\n\nDone:', result.text.length, 'chars'),
      onError: (err) => console.error('Error:', err),
    }
  );
} catch (error) {
  console.error('Client error:', error);
  process.exit(1);
}
