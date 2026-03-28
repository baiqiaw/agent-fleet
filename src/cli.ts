import { execSync } from 'node:child_process';
import { Command } from 'commander';
import pc from 'picocolors';
import { DEFAULT_CONFIG, VERSION } from './types.js';
import { startServer } from './server.js';
import { TmuxManager } from './tmux.js';

export function createCLI() {
  const program = new Command();

  program
    .name('agent-fleet')
    .description('Claude Code + Codex dual-model collaboration via MCP and tmux')
    .version(VERSION);

  // start
  program
    .command('start')
    .description('Start agent-fleet: tmux session + MCP server')
    .option('-p, --port <port>', 'MCP server port', String(DEFAULT_CONFIG.port))
    .option('--no-tmux', 'Skip tmux, just start MCP server')
    .action(async (opts) => {
      const config = { ...DEFAULT_CONFIG, port: parseInt(opts.port, 10) };

      console.log(pc.cyan('🚀 Starting agent-fleet...'));

      try {
        const { httpServer } = await startServer(config);
        console.log(pc.green(`✓ MCP server listening on http://${config.host}:${config.port}`));

        if (opts.tmux && TmuxManager.isAvailable()) {
          const tmux = new TmuxManager(config);
          if (tmux.isRunning()) {
            console.log(pc.yellow(`⚠ tmux session '${config.sessionName}' already exists, reusing`));
          } else {
            tmux.createSession(config.port);
            console.log(pc.green(`✓ tmux session '${config.sessionName}' created`));
          }
        } else if (opts.tmux && !TmuxManager.isAvailable()) {
          console.log(pc.yellow('⚠ tmux not found, running in server-only mode'));
        }

        console.log();
        console.log(pc.dim('Claude Code can now use these MCP tools:'));
        console.log(pc.dim('  - codex_run(prompt)  — execute a Codex task'));
        console.log(pc.dim('  - codex_status()     — check current status'));
        console.log(pc.dim('  - codex_cancel()     — cancel running task'));
        console.log(pc.dim('  - fleet_info()       — cluster status'));
        console.log();
        console.log(pc.dim('Press Ctrl+C to stop'));

        const shutdown = () => {
          console.log(pc.yellow('\n🛑 Shutting down...'));
          httpServer.close();
          process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      } catch (err) {
        const error = err as Error;
        console.error(pc.red(`✗ Failed to start: ${error.message}`));
        process.exit(1);
      }
    });

  // stop
  program
    .command('stop')
    .description('Stop agent-fleet: kill MCP server and tmux session')
    .action(() => {
      const tmux = new TmuxManager(DEFAULT_CONFIG);
      if (tmux.isRunning()) {
        tmux.killSession();
        console.log(pc.green('✓ tmux session destroyed'));
      }

      // Kill any process on the MCP port
      try {
        execSync(`lsof -ti:${DEFAULT_CONFIG.port} | xargs kill -9 2>/dev/null || true`, {
          stdio: 'ignore',
        });
        console.log(pc.green('✓ MCP server stopped'));
      } catch {
        console.log(pc.yellow('⚠ No MCP server process found'));
      }

      console.log(pc.green('✓ agent-fleet stopped'));
    });

  // status
  program
    .command('status')
    .description('Show agent-fleet status')
    .action(() => {
      const tmux = new TmuxManager(DEFAULT_CONFIG);
      const info = tmux.getSessionInfo();

      console.log(pc.cyan('agent-fleet status:'));
      console.log(`  tmux session: ${info.running ? pc.green('running') : pc.red('stopped')}`);
      if (info.running) {
        console.log(`  panes: ${info.panes}`);
      }
      console.log(`  MCP server: http://${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}`);
      console.log(`  log file: ${DEFAULT_CONFIG.logFile}`);
      console.log(`  version: ${VERSION}`);
    });

  // setup
  program
    .command('setup')
    .description('Output MCP config JSON for Claude Code settings')
    .action(() => {
      const mcpConfig = {
        mcpServers: {
          'agent-fleet': {
            url: `http://${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}/mcp`,
            type: 'streamable-http',
          },
        },
      };

      console.log(pc.cyan('Add this to your Claude Code settings (.claude/settings.json):'));
      console.log();
      console.log(pc.green(JSON.stringify(mcpConfig, null, 2)));
      console.log();
      console.log(pc.dim('Then run: agent-fleet start'));
      console.log(pc.dim('Claude Code will auto-connect to the MCP server.'));
    });

  return program;
}
