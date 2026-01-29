#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting TwinMCP Platform...');
console.log('================================');

// Start Next.js app
const nextApp = spawn('npm', ['run', 'start'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: process.env.PORT || '3000' }
});

// Start MCP HTTP Server
const mcpServer = spawn('node', ['packages/mcp-server/dist/start-http-server.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    TWINMCP_PORT: process.env.TWINMCP_PORT || '3001',
    TWINMCP_HOST: process.env.TWINMCP_HOST || '0.0.0.0',
    TWINMCP_API_BASE_URL: process.env.TWINMCP_API_BASE_URL || `http://localhost:${process.env.PORT || '3000'}`
  }
});

// Handle process termination
const cleanup = () => {
  console.log('\n🛑 Shutting down services...');
  nextApp.kill();
  mcpServer.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

nextApp.on('error', (err) => {
  console.error('❌ Next.js app error:', err);
});

mcpServer.on('error', (err) => {
  console.error('❌ MCP Server error:', err);
});

nextApp.on('exit', (code) => {
  console.log(`Next.js app exited with code ${code}`);
  if (code !== 0) mcpServer.kill();
});

mcpServer.on('exit', (code) => {
  console.log(`MCP Server exited with code ${code}`);
});

console.log('✅ Services starting...');
console.log('   - Next.js App: http://localhost:' + (process.env.PORT || '3000'));
console.log('   - MCP Server:  http://localhost:' + (process.env.TWINMCP_PORT || '3001'));
