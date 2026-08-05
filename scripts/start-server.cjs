const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = path.resolve(__dirname, '..');
const logFile = path.join(projectDir, 'server.log');

function startServer() {
  // Clear old log
  try { fs.writeFileSync(logFile, ''); } catch {}
  
  console.log('Starting Next.js dev server with 1GB memory...');
  const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: projectDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=1024'
    }
  });

  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
    logStream.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
    logStream.write(data);
  });

  child.on('exit', (code, signal) => {
    console.log(`Server exited with code ${code}, signal ${signal}. Restarting in 5s...`);
    logStream.write(`\n--- Server exited. Restarting in 5s ---\n`);
    setTimeout(startServer, 5000);
  });

  return child;
}

startServer();
