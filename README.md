# agent-fleet

Claude Code + Codex 双模型协作工具。通过 MCP (Model Context Protocol) 和 tmux 实现 Claude Code 主控、Codex 执行的实时协作。

## 架构

```
┌─────────────────────────┬──────────────────────────┐
│                         │                          │
│  Claude Code            │  Codex Output            │
│  (用户交互, MCP client)  │  (实时流式日志)            │
│         │               │                          │
│         │ MCP/HTTP      │  tail -f /tmp/fleet.log  │
│         ▼               │            ▲             │
│  ┌──────────────┐       │            │             │
│  │ MCP Server   │───────┼── codex exec --json      │
│  │ (HTTP :9876) │       │            │             │
│  └──────────────┘       │            ▼             │
│                         │  [codex subprocess]      │
└─────────────────────────┴──────────────────────────┘
```

## 安装

```bash
cd ~/projects/agent-fleet
npm install
```

### 前置要求

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- [Codex CLI](https://github.com/openai/codex) (`npm install -g @openai/codex`)
- tmux（可选，用于分屏）

## 使用

### 1. 启动

```bash
# 启动 MCP server + tmux 分屏
npx tsx src/cli.ts start

# 仅启动 MCP server（不用 tmux）
npx tsx src/cli.ts start --no-tmux

# 指定端口
npx tsx src/cli.ts start -p 9999
```

### 2. 配置 Claude Code

在项目的 `.claude/settings.json` 或全局 `~/.claude/settings.json` 中添加：

```json
{
  "mcpServers": {
    "agent-fleet": {
      "url": "http://127.0.0.1:9876/mcp",
      "type": "streamable-http"
    }
  }
}
```

或运行 `npx tsx src/cli.ts setup` 查看配置。

### 3. 在 Claude Code 中使用

配置完成后，Claude Code 可以使用以下 MCP 工具：

| 工具 | 说明 |
|------|------|
| `codex_run(prompt)` | 向 Codex 下发任务 |
| `codex_status()` | 检查 Codex 当前状态 |
| `codex_cancel()` | 取消正在运行的任务 |
| `fleet_info()` | 查看集群状态 |

### 4. 停止

```bash
npx tsx src/cli.ts stop
```

## MCP 工具详情

### codex_run

```typescript
codex_run({
  prompt: "实现一个快速排序函数",
  cwd: "/path/to/project",     // 可选：工作目录
  model: "o3",                 // 可选：指定模型
  sandbox: "workspace-write"   // 可选：沙箱策略
})
```

返回：
```json
{
  "taskId": "uuid",
  "output": "任务输出...",
  "exitCode": 0,
  "state": "completed"
}
```

## 开发

```bash
# 开发模式（热重载）
npm run dev

# 编译
npm run build

# 测试
npm test

# 类型检查
npx tsc --noEmit
```

## License

MIT
