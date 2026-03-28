import { spawn, ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Task, CodexRunOptions, CodexEvent, FleetConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

export class CodexManager {
  private currentTask: Task | null = null;
  private currentProcess: ChildProcess | null = null;
  private logStream: ReturnType<typeof createWriteStream> | null = null;
  private tasksCompleted = 0;
  private startTime: number | null = null;
  private readonly config: FleetConfig;

  constructor(config: typeof DEFAULT_CONFIG) {
    this.config = config;
  }

  get task(): Task | null {
    return this.currentTask;
  }

  get completed(): number {
    return this.tasksCompleted;
  }

  get running(): boolean {
    return this.currentTask?.state === 'running';
  }

  /** Run a Codex task */
  async run(prompt: string, options?: CodexRunOptions): Promise<Task> {
    if (this.running) {
      throw new Error('Codex is already running a task. Cancel it first.');
    }

    const taskId = randomUUID();
    const task: Task = {
      id: taskId,
      prompt,
      state: 'running',
      exitCode: null,
      output: '',
      startedAt: new Date(),
      completedAt: null,
      cwd: options?.cwd,
      model: options?.model,
    };

    this.currentTask = task;
    this.startTime ??= Date.now();

    // Ensure log directory exists
    mkdirSync(dirname(this.config.logFile), { recursive: true });
    this.logStream = createWriteStream(this.config.logFile, { flags: 'a' });

    const args = ['exec', '--json'];
    if (options?.model) args.push('-m', options.model);
    if (options?.sandbox) args.push('-s', options.sandbox);
    if (options?.cwd) args.push('-C', options.cwd);

    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.codexCommand, [...args, prompt], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });
      this.currentProcess = proc;

      const logLine = (prefix: string, data: string) => {
        const ts = new Date().toISOString();
        const line = `[${ts}] [${prefix}] ${data}\n`;
        this.logStream?.write(line);
      };

      proc.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        task.output += text;
        logLine('stdout', text.trimEnd());

        // Parse JSONL events
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          try {
            const event: CodexEvent = JSON.parse(line);
            logLine('event', `${event.type}: ${event.content ?? ''}`);
          } catch {
            // Not JSON, just raw text
          }
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        task.output += text;
        logLine('stderr', text.trimEnd());
      });

      proc.on('close', (code) => {
        task.exitCode = code ?? 0;
        task.state = code === 0 ? 'completed' : 'failed';
        task.completedAt = new Date();
        this.currentProcess = null;
        this.tasksCompleted++;

        logLine('exit', `code=${code} task=${taskId}`);

        this.logStream?.end();
        this.logStream = null;

        resolve(task);
      });

      proc.on('error', (err) => {
        task.state = 'failed';
        task.exitCode = -1;
        task.output += `\nError: ${err.message}`;
        task.completedAt = new Date();
        this.currentProcess = null;
        this.tasksCompleted++;

        logLine('error', err.message);
        this.logStream?.end();
        this.logStream = null;

        resolve(task);
      });
    });
  }

  /** Cancel the current running task */
  cancel(): boolean {
    if (!this.currentProcess || !this.running) {
      return false;
    }
    this.currentProcess.kill('SIGTERM');
    if (this.currentTask) {
      this.currentTask.state = 'cancelled';
      this.currentTask.completedAt = new Date();
    }
    this.currentProcess = null;
    this.logStream?.end();
    this.logStream = null;
    this.tasksCompleted++;
    return true;
  }

  /** Get fleet uptime in seconds */
  getUptime(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
