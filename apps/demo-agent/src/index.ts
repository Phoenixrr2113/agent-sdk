import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

function runServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const server = spawn('npx', ['tsx', 'src/server.ts'], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let resolved = false;

    const closeListener = (code: number | null) => {
      if (!resolved && code !== null && code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    };
    server.on('close', closeListener);

    server.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[Server]', output.trim());
      
      if (!resolved && output.includes('Agent server started on port 3001')) {
        resolved = true;
        server.removeListener('close', closeListener);
        setTimeout(() => resolve(server), 500);
      }
    });

    server.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('ExperimentalWarning')) {
        console.error('[Server stderr]', msg);
      }
    });

    server.on('error', reject);

    setTimeout(() => {
      if (!resolved) {
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
  });
}

async function runClient() {
  return new Promise<void>((resolve, reject) => {
    const client = spawn('npx', ['tsx', 'src/client.ts'], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    client.stdout?.on('data', (data) => {
      console.log('[Client]', data.toString().trim());
    });

    client.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('ExperimentalWarning')) {
        console.error('[Client stderr]', msg);
      }
    });

    client.on('close', (code) => {
      console.log(`[Client] exited with code ${code}`);
      if (code === 0) resolve();
      else reject(new Error(`Client exited with code ${code}`));
    });
  });
}

async function main() {
  let server: ChildProcess | undefined;
  
  try {
    console.log('Starting server...');
    server = await runServer();
    console.log('Server started. Running client...');
    
    await runClient();
    console.log('Test completed successfully.');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    if (server) {
      server.kill();
    }
    process.exit(0);
  }
}

main();
