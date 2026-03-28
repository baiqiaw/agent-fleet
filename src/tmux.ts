import { execSync } from 'node:child_process';
import type { FleetConfig } from './types.js';

export class TmuxManager {
  private readonly config: FleetConfig;

  constructor(config: FleetConfig) {
    this.config = config;
  }

  /** Check if tmux is available on the system */
  static isAvailable(): boolean {
    try {
      execSync('which tmux', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /** Check if the agent-fleet session is running */
  isRunning(): boolean {
    try {
      execSync(`tmux has-session -t ${this.config.sessionName} 2>/dev/null`, {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Create the tmux session with left/right split */
  createSession(mcpPort: number): void {
    if (this.isRunning()) {
      throw new Error(`tmux session '${this.config.sessionName}' already exists`);
    }

    // Create detached session
    execSync(
      `tmux new-session -d -s ${this.config.sessionName} -x 200 -y 50`,
      { stdio: 'ignore' }
    );

    // Split horizontally (left/right)
    execSync(
      `tmux split-window -h -t ${this.config.sessionName}`,
      { stdio: 'ignore' }
    );

    // Right pane: tail -f log file
    execSync(
      `tmux send-keys -t ${this.config.sessionName}:0.1 'tail -f ${this.config.logFile}' Enter`,
      { stdio: 'ignore' }
    );

    // Set pane titles
    execSync(
      `tmux select-pane -t ${this.config.sessionName}:0.0 -T "Claude Code"`,
      { stdio: 'ignore' }
    );
    execSync(
      `tmux select-pane -t ${this.config.sessionName}:0.1 -T "Codex Output"`,
      { stdio: 'ignore' }
    );
  }

  /** Kill the tmux session */
  killSession(): void {
    try {
      execSync(`tmux kill-session -t ${this.config.sessionName} 2>/dev/null`, {
        stdio: 'ignore',
      });
    } catch {
      // Session may not exist
    }
  }

  /** Get session info */
  getSessionInfo(): { running: boolean; panes: number } {
    if (!this.isRunning()) {
      return { running: false, panes: 0 };
    }
    try {
      const output = execSync(
        `tmux list-panes -t ${this.config.sessionName} -F '#{pane_index}'`,
        { encoding: 'utf-8' }
      ).trim();
      const panes = output.split('\n').length;
      return { running: true, panes };
    } catch {
      return { running: false, panes: 0 };
    }
  }
}
