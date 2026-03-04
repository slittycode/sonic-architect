# Team Workflow After Repo Split

## Repository roles

- `sonic-architect-app` (active): product runtime, UI, services, tests, CI.
- `sonic-architect-lab` (active): skills, archive material, plans, historical docs/artifacts.
- `sonic-architect` (historical): split source and traceability only. No new feature work.

## Rules of engagement

1. Feature work goes to `sonic-architect-app`.
2. Skills/history/docs-only work goes to `sonic-architect-lab`.
3. Do not open new feature PRs against `sonic-architect`.
4. Keep split tags (`pre-split-final`, `split-source-frozen`) for auditability.

## Migration pointers

- App repo: <https://github.com/slittycode/sonic-architect-app>
- Lab repo: <https://github.com/slittycode/sonic-architect-lab>
