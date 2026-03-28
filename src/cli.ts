import { execSync } from 'node:child_process';
import { Command } from 'commander';
import pc from 'picocolors';
import { DEFAULT_CONFIG, VERSION } from './types.js';
import { TmuxManager } from './tmux.js';

export function createCLI() {
  const program = new Command();

  program
    .name('agent-fleet')
    .description('Claude Code + Codex dual-model collaboration via MCP and tmux')
    .version(VERSION);

  // start — create tmux split-screen for Codex output monitoring
  program
    .command('start')
    .description('Start tmux split-screen with real-time Codex output (MCP runs via stdio)')
    .action(() => {
      console.log(pc.cyan('🚀 Starting agent-fleet monitor...'));

      if (!TmuxManager.isAvailable()) {
        console.error(pc.red('✗ tmux not found. Install: sudo apt install tmux'));
        process.exit(1);
      }

      const tmux = new TmuxManager(DEFAULT_CONFIG);

      if (tmux.isRunning()) {
        console.log(pc.yellow(`⚠ tmux session '${DEFAULT_CONFIG.sessionName}' already running`));
        console.log(pc.dim(`  Run 'agent-fleet stop' first, or 'tmux attach -t ${DEFAULT_CONFIG.sessionName}'`));
        process.exit(1);
      }

      // Ensure log file exists
      execSync(`touch ${DEFAULT_CONFIG.logFile}`, { stdio: 'ignore' });

      // Create tmux session with left/right split
      tmux.createSession();

      // Right pane: tail -f log file (real-time Codex output)
      execSync(
        `tmux send-keys -t ${DEFAULT_CONFIG.sessionName}:0.1 'tail -f ${DEFAULT_CONFIG.logFile}' Enter`,
        { stdio: 'ignore' }
      );

      console.log(pc.green(`✓ tmux session '${DEFAULT_CONFIG.sessionName}' created`));
      console.log(pc.green(`✓ Right pane: monitoring ${DEFAULT_CONFIG.logFile}`));
      console.log();
      console.log(pc.dim('Now start Claude Code (in tmux left pane or separately).'));
      console.log(pc.dim('Claude will auto-connect to agent-fleet MCP via stdio.'));
      console.log();
      console.log(pc.cyan('To view split screen:'));
      console.log(pc.white(`  tmux attach -t ${DEFAULT_CONFIG.sessionName}`));
    });

  // stop
  program
    .command('stop')
    .description('Stop agent-fleet: destroy tmux session')
    .action(() => {
      const tmux = new TmuxManager(DEFAULT_CONFIG);
      if (tmux.isRunning()) {
        tmux.killSession();
        console.log(pc.green('✓ tmux session destroyed'));
      } else {
        console.log(pc.yellow('⚠ No tmux session running'));
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
      console.log(`  log file: ${DEFAULT_CONFIG.logFile}`);
      console.log(`  MCP mode: stdio (auto-started by Claude Code)`);
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
            command: 'npx',
            args: ['tsx', '/home/cgh/projects/agent-fleet/src/stdio.ts'],
          },
        },
      };

      console.log(pc.cyan('Add this to ~/.claude/settings.json under "mcpServers":'));
      console.log();
      console.log(pc.green(JSON.stringify(mcpConfig, null, 2)));
      console.log();
      console.log(pc.dim('Then for split-screen experience:'));
      console.log(pc.dim('  1. Run: npx tsx ~/projects/agent-fleet/src/cli.ts start'));
      console.log(pc.dim('  2. In tmux left pane or new terminal: claude'));
      console.log(pc.dim('  3. Right pane auto-shows Codex output'));
    });

  return program;
}

// Auto-parse when run directly (npx tsx src/cli.ts ...)
createCLI().parse();
