import fs from 'fs';
import { execSync } from 'child_process';

const LOG_FILE = 'agent_notifications.log';
const CHECK_INTERVAL = 10000; // Check every 10 seconds for more responsiveness in this demo

let knownAgents = new Map();

function getRunningAgents() {
  try {
    const output = execSync('ps aux').toString();
    const lines = output.split('\n');
    const agents = [];
    for (const line of lines) {
      if ((line.includes('agntk') || line.includes('node')) && 
          !line.includes('grep') && 
          !line.includes('agent_monitor.mjs') &&
          !line.includes('ps aux')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;
        const pid = parts[1];
        const command = parts.slice(10).join(' ');
        agents.push({ pid, command });
      }
    }
    return agents;
  } catch (err) {
    console.error('Error fetching agents:', err);
    return [];
  }
}

function log(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, entry);
  } catch (err) {
    console.error('Error writing to log:', err);
  }
  process.stdout.write(entry);
}

function monitor() {
  const currentAgents = getRunningAgents();
  const currentAgentPids = new Set(currentAgents.map(a => a.pid));

  // Check for new agents
  for (const agent of currentAgents) {
    if (!knownAgents.has(agent.pid)) {
      log(`DETECTED: Agent process PID ${agent.pid} - ${agent.command}`);
      knownAgents.set(agent.pid, agent);
    }
  }

  // Check for finished agents
  for (const [pid, agent] of knownAgents.entries()) {
    if (!currentAgentPids.has(pid)) {
      log(`CLEARED: Agent process PID ${pid} - ${agent.command} has stopped.`);
      knownAgents.delete(pid);
    }
  }
}

log("Agent monitor service started.");
setInterval(monitor, CHECK_INTERVAL);
monitor();
