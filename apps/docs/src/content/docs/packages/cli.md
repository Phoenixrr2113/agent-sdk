---
title: "CLI"
description: "CLI agent — one-shot prompts, interactive REPL, persistent memory"
---

```bash
# One-shot prompt
agntk "organize this folder by date"

# Named agent (enables persistent memory)
agntk -n my-agent "fix the failing tests"

# Interactive REPL
agntk -i

# With custom instructions
agntk --name code-reviewer --instructions "You are a code reviewer" "review src/"

# Pipe input
cat error.log | agntk "explain these errors"
```

| Flag | Short | Description |
|------|-------|-------------|
| `--name` | `-n` | Agent name (enables persistent memory) |
| `--instructions` | | System prompt text |
| `--interactive` | `-i` | Interactive REPL mode |
| `--workspace` | | Workspace root (default: cwd) |
| `--max-steps` | | Maximum agent steps (default: 25) |
| `--verbose` | | Show full tool args/output |
| `--quiet` | `-q` | Text output only (for piping) |
| `--version` | `-v` | Show version |
| `--help` | `-h` | Show help |

---
