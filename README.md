<div align="center">

# 🕸️ cmd-mod-graphify

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![CommandCode](https://img.shields.io/badge/CommandCode-v1.7.0+-purple.svg)](https://commandcode.ai/)
[![Graphify](https://img.shields.io/badge/Graphify-v0.9.32+-emerald.svg)](https://github.com/Graphify-Labs/graphify)

**Turn any codebase into a deterministic, queryable Knowledge Graph inside CommandCode.**

[ English ](README.md) | [ Français ](README.fr.md)

</div>

---

## Quick start

```bash
# 1. Install Graphify CLI
uv tool install graphifyy

# 2. Launch CommandCode with the mod
cmd --mod /path/to/cmd-mod-graphify/graphify.ts

# 3. Build the graph
/graphify
```

Runs 100% locally with AST extraction. No LLM API key required.

---

## What it does

This mod integrates [Graphify](https://github.com/Graphify-Labs/graphify) into [CommandCode](https://commandcode.ai). It parses your source code with Tree-sitter, builds a graph of classes, functions, imports, and calls, then lets you query, visualize, and explore your architecture through slash commands and AI tools.

---

## Features

- **14 slash commands** for building, querying, tracing, and visualizing the graph
- **10 AI tools** so the model can explore your codebase autonomously
- **Interactive D3 trees and Mermaid call-flow diagrams** that open in your browser
- **Auto-generated wiki** organized by code communities
- **God-nodes detection** to find architectural hubs
- **`.graphifyignore`** with full pattern exclusion and `!` negation
- **System prompt enrichment** that feeds graph context to the AI on every turn

---

## Chat shortcuts

Type in the chat prompt without slash commands:

- `@graph <question>` — query the graph, AI synthesizes the answer
- `@explain <symbol>` — analyze a symbol's connections and role

---

## Loading the mod

**One-time session:**
```bash
cmd --mod /path/to/cmd-mod-graphify/graphify.ts
```

**Per-project (auto-loads):**
```bash
mkdir -p .commandcode/mods/
cp /path/to/cmd-mod-graphify/graphify.ts .commandcode/mods/
```

---

## Command reference

See [docs/COMMANDS.md](docs/COMMANDS.md) for the full slash command and AI tool reference, system requirements, and architecture details.

---

## Contributing

Bug reports and contributions are welcome. Follow the issue templates:

- [Report a bug](.github/ISSUE_TEMPLATE/bug_report.md)
- [Request a feature](.github/ISSUE_TEMPLATE/feature_request.md)

---

## License

MIT License. Independent community mod, not officially affiliated with Graphify-Labs or Langbase, Inc.
