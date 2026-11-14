# Agent handbook

This handbook applies to repository work by coding agents. Read the current checkout before relying on earlier reports.

| Read | Purpose |
|---|---|
| [Working agreement](../../AGENTS.md) | Repository rules |
| [Workflow](WORKFLOW.md) | Branches, evidence, implementation and handoff |
| [Contracts and ownership](CONTRACTS.md) | Source of truth and shared modules |
| [Verification](VERIFICATION.md) | Reproducible checks and release gates |
| [Release process](../ENGINEERING/RELEASE_PROCESS.md) | Version, tag and publication |
| [Current discussions](../discussion/) | Findings, decisions and remaining gaps |

Branch choice follows the user's latest explicit instruction. Do not infer a review branch from an earlier task or a stale note in this handbook.

English and Vietnamese are both accepted. Use concrete repro steps, expected behavior, observed behavior, commit IDs and verification results. A historical PASS describes its recorded fixture and commit.

Current refactor: [plan](../discussion/EDITOR_REFACTOR_PLAN.md) and [phase report](../discussion/EDITOR_REFACTOR_PROGRESS.md). Preserve app-specific ports when extending shared editor commands.
