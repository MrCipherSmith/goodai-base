# Security Policy

## Supported Versions

goodai-base is a knowledge-base repository for AI agent skills and rules. It contains executable shell scripts (`install.sh`, `scripts/templates/skill-evaluator.sh`), TypeScript build scripts (`scripts/src/`), and a JavaScript hook (`hooks/skill-eval.js`) that runs with user-level privileges inside Claude Code sessions. There are no compiled binaries or server infrastructure. There is no version matrix for security patches.

## Reporting a Vulnerability

If you discover a security issue in this repository — for example:

- A skill or rule that instructs an AI agent to perform an unsafe action (e.g. deleting files without confirmation, running destructive commands, leaking credentials)
- A script in `scripts/` that has a shell injection or privilege escalation vulnerability
- Hook configurations that could be exploited by a malicious project

**Please do NOT open a public GitHub issue.**

Instead, report it via GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/MrCipherSmith/goodai-base/security)
2. Click **"Report a vulnerability"**
3. Describe the issue, affected file(s), and potential impact

We aim to respond within **72 hours** and resolve confirmed issues within **7 days**.

## Scope

| In scope | Out of scope |
|---|---|
| Skills/rules instructing unsafe agent behavior | Bugs in Claude, Cursor, or other AI tools themselves |
| Shell scripts with injection vulnerabilities (e.g. `skill-evaluator.sh`) | Issues in third-party MCP servers |
| Hook configs that could expose sensitive data | Feature requests |
| Shell injection in `scripts/templates/skill-evaluator.sh` via project config files | Theoretical attacks requiring physical machine access |

## Philosophy

goodai-base runs inside AI agent environments with access to your filesystem and shell. Every skill and rule should follow the principle of **least privilege** — request only what is needed, confirm before destructive actions, never silently escalate.
