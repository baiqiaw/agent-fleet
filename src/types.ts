// Shared types & constants for agent-fleet

/** Codex subprocess state */
export type CodexState = 'idle' | 'running';

/** Task status */
export interface Task {
  id: string;
  prompt: string;
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  exitCode: number | null;
  output: string;
  startedAt: Date | null;
  completedAt: Date | null;
  cwd?: string;
  model?: string;
}

/** Options for codex_run tool */
export interface CodexRunOptions {
  cwd?: string;
  model?: string;
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
}

/** Fleet configuration */
export interface FleetConfig {
  port: number;
  host: string;
  logFile: string;
  sessionName: string;
  codexCommand: string;
}

/** Fleet runtime status */
export interface FleetStatus {
  running: boolean;
  taskId: string | null;
  startTime: number | null;
  tasksCompleted: number;
  uptime: number;
  serverVersion: string;
}

/** JSONL event from codex exec --json */
export interface CodexEvent {
  type: string;
  content?: string;
  [key: string]: unknown;
}

/** Default configuration */
export const DEFAULT_CONFIG: FleetConfig = {
  port: 9876,
  host: '127.0.0.1',
  logFile: '/tmp/agent-fleet.log',
  sessionName: 'agent-fleet',
  codexCommand: 'codex',
};

export const VERSION = '0.1.0';
