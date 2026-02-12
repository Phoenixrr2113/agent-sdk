---
title: "CLI"
description: "CLI agent — one-shot prompts, interactive REPL, persistent memory"
---

```bash
# One-shot prompt
agntk "organize this folder by date"

# Interactive REPL
agntk -i --memory

# With specific role and model
agntk --role coder --model google/gemini-3-flash-preview "fix the failing tests"

# Pipe input
cat error.log | agntk "explain these errors"

# Dry run (preview actions)
agntk --dry-run "delete old logs"
```

| Flag | Short | Description |
|------|-------|-------------|
| `--interactive` | `-i` | Interactive REPL mode |
| `--role` | `-r` | Agent role (`generic`, `coder`, `researcher`, `analyst`) |
| `--model` | `-m` | Model to use (e.g. `google/gemini-3-flash-preview`) |
| `--memory` | | Enable persistent memory |
| `--tools` | | Tool preset (`minimal`, `standard`, `full`) |
| `--workspace` | | Workspace root (default: cwd) |
| `--max-steps` | | Maximum agent steps |
| `--dry-run` | | Preview actions without executing |
| `--verbose` | | Show detailed logging |
| `--config` | | Config file path |
| `--init` | | Initialize `.agntk/` directory with templates |
| `--version` | `-v` | Show version |
| `--help` | `-h` | Show help |

---
