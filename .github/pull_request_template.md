## Summary

<!-- What changed and why? Link related issues: Fixes #123 -->

## Type of change

- [ ] Bug fix (resolve, vendor, build, or CLI)
- [ ] Feature (new command, registry client, lockfile behavior, …)
- [ ] Refactor (no behavior change)
- [ ] Tests / fixtures only
- [ ] Tooling (CI, hooks, docs)
- [ ] Breaking change

## Compiler coupling

- [ ] No [pactia-lang/pactiac](https://github.com/pactia-lang/pactiac) changes required
- [ ] Requires pactiac PR linked or described below
- [ ] Tested against local `../pactiac` sibling checkout

**pactiac PR / notes (if any):**

## Test plan

- [ ] `npm test` passes locally (with `../pactiac` built)
- [ ] `npm run hooks:install` — pre-commit / pre-push hooks considered
- [ ] Manual check: `pactia build -C <workspace>`

**Commands / scenarios exercised:**

```bash
# paste commands or describe manual checks
```

## Breaking changes

<!-- List CLI or manifest behavior changes. Write "None" if not applicable. -->

None
