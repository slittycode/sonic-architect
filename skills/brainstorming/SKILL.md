---
name: brainstorming
description: Use when requirements are unclear or the user asks to brainstorm/design before implementation.
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into a clear design/spec through collaborative dialogue.

Core constraint: avoid infinite clarification loops. Timebox questions, then propose with explicit assumptions.

## Stop Conditions (required)

- **Question budget:** Ask at most **3** clarification turns total.
- **Exit criteria:** Once you can state (1) goal, (2) constraints, and (3) success criteria, proceed to approaches/design even if some details are unknown.
- **User override:** If the user says anything like "make a plan", "good enough", "proceed", "ship it", or "start building", stop asking questions and move forward.

## The Process

**1) Understand the idea (timeboxed)**
- Skim current project context first (files, docs, recent commits).
- Ask **one** clarifying question per message.
- Prefer multiple choice questions when possible.
- If you hit the question budget, proceed with assumptions.

**2) Explore approaches**
- Propose 2-3 different approaches with trade-offs.
- Lead with your recommended option and explain why.

**3) Present the design**
- Break into sections (200-300 words each).
- After each section, ask if it looks right so far.
- Cover: architecture, components, data flow, error handling, testing.

**4) Handle unknowns without stalling**
- If information is missing but non-blocking, add an **Assumptions** list and proceed.
- Only ask additional questions if they are truly blocking for choosing an approach.

## After the Design (optional)

**Documentation:**
- If working in a git repo and it would be helpful, write the validated design to `docs/plans/YYYY-MM-DD-<topic>-design.md`.

**Implementation (if continuing):**
- Ask: "Ready to set up for implementation?"
- Use superpowers:using-git-worktrees to create isolated workspace.
- Use superpowers:writing-plans to create detailed implementation plan.

## Common Failure Modes

- **Endless questions:** If you asked 3 clarifying questions, stop and proceed with assumptions.
- **Overfitting to unknowns:** Don’t block on details that can be decided later; record them as assumptions/risks.
