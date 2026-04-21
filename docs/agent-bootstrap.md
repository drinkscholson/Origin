# Agent Bootstrap Runner

Origin includes a bootstrap runner that assembles AI-facing training context automatically.

Its job is to combine:

- the Origin system prompt
- the quickstart guide
- the playbook
- a selectable number of drills

into one model-ready context bundle.

## Commands

Print a full bootstrap bundle:

```bash
npm run bootstrap:agent
```

Limit the drill count:

```bash
npm run bootstrap:agent -- --drills 3
```

Constrain the bundle by approximate model tokens:

```bash
npm run bootstrap:agent -- --token-budget 1200
```

Use both controls together:

```bash
npm run bootstrap:agent -- --drills 5 --token-budget 1500
```

Write the bundle to a file:

```bash
npm run bootstrap:agent -- --out artifacts/origin-bootstrap.md
```

Exclude sections:

```bash
npm run bootstrap:agent -- --no-playbook --drills 2
```

## Budget behavior

When a token budget is provided, the runner tries to stay within budget by shrinking lower-priority content in this order:

1. reduce drill count
2. remove the playbook
3. remove the quickstart
4. remove the introduction

The system prompt and runtime instruction remain anchored because they are the minimum viable training contract.

## Why this matters

This turns the repository into something an agent can learn from immediately.

Instead of manually copying several files into a prompt window, the runner builds a consistent training context automatically.
