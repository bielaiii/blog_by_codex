---
tab: projects
title: gdb-agent
date: 2026-06-15
summary: 一个 vibe-coding 推出来的 GDB/MI 调试执行层，把调试动作、会话状态和证据资产组织成可审计的 evidence flow。
tags: [C++, GDB, Debugging, Vibe Coding]
stage: 架构主线已成型：Vibe Coding Loop -> Session -> Action -> Evidence -> Report
stack: [C++20, GDB/MI, daemon, JSONL, Markdown]
metrics: [vibe-coding, evidence flow, session runtime]
repo: https://github.com/bielaiii/gdb_cli_tools
---

# gdb-agent

`gdb-agent` 是 vibe-coding 推出来的调试工具：先让 Agent 快速提出假设和动作，再让工具稳定执行 GDB/MI、维护 session、保存 evidence，并生成可审计的报告资产。

项目仓库：[bielaiii/gdb_cli_tools](https://github.com/bielaiii/gdb_cli_tools)

## Architecture

```mermaid
flowchart TB
  Agent["AI Agent"] --> Plan["hypothesis / next action"]
  Plan --> Runtime["gdb-agent runtime"]

  subgraph RuntimeBox["gdb-agent"]
    Task["task file"]
    Session["live session"]
    Action["action dispatcher"]
    Evidence["evidence store"]
    Replay["replay log"]
    Report["report builder"]
  end

  Runtime --> Task
  Task --> Session
  Session --> Action
  Action --> GDB["GDB/MI"]
  GDB --> Evidence
  Evidence --> Agent
  Evidence --> Report
  Action --> Replay
```

这张图是项目的主体：`gdb-agent` 位于 Agent 和 GDB/MI 之间，不抢推理职责，只稳定地执行动作、收集证据、沉淀会话。

## Capabilities

```mermaid
mindmap
  root((gdb-agent))
    Session
      create
      status
      finish
      close
      daemon
    Debug Actions
      backtrace
      locals
      registers
      threads
      evaluate
      frame_select
    Probes
      breakpoint
      watchpoint
      catchpoint
    Evidence
      raw MI
      summary
      index
      hash
    Reasoning Aid
      hypothesis
      replay
      report
```

功能展示可以按“面向 Agent 的能力面”来组织，而不是堆命令清单：

| 能力面 | 支持内容 |
| --- | --- |
| Session runtime | daemon、create、action、status、finish、close |
| Debug action | backtrace、locals、registers、threads、evaluate、frame_select |
| Probe control | breakpoint、watchpoint、catchpoint、probe enable/disable/delete |
| Evidence flow | raw MI、低噪声 summary、index、raw hash |
| Agent workflow | hypothesis create/check/conclude、replay、report |

## Flow

```mermaid
sequenceDiagram
  participant A as Agent
  participant T as Task
  participant S as Session
  participant G as GDB/MI
  participant E as Evidence
  participant R as Report

  A->>T: describe target
  A->>S: create session
  A->>S: choose action
  S->>G: execute MI command
  G-->>S: raw result
  S->>E: store raw + summary
  E-->>A: evidence view
  A->>S: next action / hypothesis
  A->>R: finish
  E->>R: evidence index
```

这个 flow 说明了项目最重要的边界：Agent 可以多轮探索，但每一步都落在 session log 和 evidence store 里。最后报告不是凭空生成，而是引用已经保存的证据。

## Boundaries

```mermaid
flowchart LR
  Tool["gdb-agent records evidence"] --> Agent["Agent interprets evidence"]
  Agent --> Conclusion["root-cause conclusion"]
  Tool --> Assets["raw MI / summary / replay / report assets"]
```

设计边界保持清楚：

- 目标平台是 Linux。
- 调试执行通过 GDB/MI，不走 PTY。
- `raw_mi` 是 escape hatch，而不是默认交互方式。
- replay 重放的是高层 action，不是恢复旧 GDB 进程。
- 工具记录证据，最终根因判断属于 Agent。
