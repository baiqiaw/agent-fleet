#!/usr/bin/env npx tsx
import { startStdioServer } from './server.js';

startStdioServer().catch((err) => {
  console.error('Failed to start agent-fleet MCP server:', err);
  process.exit(1);
});
