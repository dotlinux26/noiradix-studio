# Working through a change

1. Inspect `git status`, current branch, remotes, recent commits and local instructions. Identify existing user changes and untracked assets. Preserve their ownership and stage only the files belonging to the task.
2. Fetch remote refs before choosing a baseline. Create or reuse the requested review branch. Record its base SHA and app/format versions in `docs/discussion/`.
3. Read the relevant contracts and trace the normal UI entry point through the controller to the shared engine. Treat attached notes and earlier agent reports as evidence to reproduce.
4. Give each confirmed finding a stable ID. Record the app, trigger, observed result, expected result, affected modules, fix, regression check and remaining coverage.
5. Implement the smallest complete fix. Reuse shared ownership, coordinate, raster, compositing and transform logic. Keep document history and persistence consistent across exceptions, retries, document switches and interrupted gestures.
6. Run the checks required by `AGENTS.md` and the focused checks for the regression. If a check fails, diagnose its cause before changing the expectation. Keep browser tests enabled in CI.
7. Review the staged diff. Update contracts when behavior changes. Report the commit, branch, checks actually run and remaining limitations.

Code in `js/` must keep static deployment working. A new runtime package, new storage format, migration or deployment change needs a task-specific reason.

Use exact paths when handing work to another agent. Identify the expected inputs, outputs and ownership of shared files. Delegate only when the user or repository instructions authorize delegation.

## Finding record

```markdown
### RC2-001

- App and baseline commit
- Repro steps and fixture
- Expected result
- Observed result
- Root cause and affected entry points
- Implementation and compatibility decisions
- Checks run and their result
- Remaining cases
```
