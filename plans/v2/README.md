# Implementation Plans v2

**Generated:** 2026-02-09  
**Replaces:** [v1 plans](../README.md)

## Philosophy

The v1 plans were primarily housekeeping — fixing DX issues, adding linting, validating inputs. They didn't move the product forward or address the elephant in the room: **the entire analysis pipeline depends on a paid API key to Gemini 1.5 Pro**.

These v2 plans focus on:

1. **Removing the hard Gemini dependency** by building real client-side audio analysis
2. **Making the AI layer optional and swappable** (Ollama, CLI models, or no LLM at all)
3. **Shipping real features** that make the tool genuinely useful to producers
4. **Building toward the agent ecosystem** outlined in AGENT_IDEAS.md

## Plan overview

| Plan                      | File                                                             | Scope                                                                                                        |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1 — Local Analysis Engine | [plan-1-local-engine.md](plan-1-local-engine.md)                 | Replace Gemini with client-side DSP + real audio analysis; make app work offline with zero API keys          |
| 2 — Optional LLM Layer    | [plan-2-optional-llm.md](plan-2-optional-llm.md)                 | Add optional Ollama/local LLM integration for richer interpretive text; keep app fully functional without it |
| 3 — Production Hardening  | [plan-3-production-hardening.md](plan-3-production-hardening.md) | Real waveform, test suite, build pipeline fixes, blueprint export, error recovery, DX improvements           |
| 4 — Agent Expansion       | [plan-4-agent-expansion.md](plan-4-agent-expansion.md)           | Session Musician (audio-to-MIDI) MVP, architecture for future agents                                         |

## Execution order

```
Plan 1 (Local Engine) ──→ Plan 2 (Optional LLM) ──→ Plan 4 (Agents)
         │
         └──→ Plan 3 (Hardening) can run in parallel
```

Plan 1 is the foundation. Plan 3 can be interleaved at any point. Plan 2 and 4 build on Plan 1's abstractions.
