# Natural-Language Compiler Prototype

Origin now includes a controlled-English compiler prototype.

Its purpose is not to understand arbitrary prose. Its purpose is to convert constrained human input into valid Origin packets so the language can enter the input path.

## Goal

Turn input like:

```text
Agent self asserts that door is open and alarm is off based on camera 12@14:03 with 91% confidence. Observe next. Context room A.
```

into:

```text
O1 $auto-self-assert-door-... @self !a [door=open,alarm=off] ^cam:12@14:03 %91 ~obs #room=A
```

## Supported input shape

The compiler currently accepts controlled English in this form:

```text
Packet <id> from agent <agent> <kind> that <claims>.
Based on <evidence>.
With <percent>% confidence.
<Intent> next.
Responds to <packet-id>.
Depends on <packet-id>, <packet-id>.
Context <key> <value>, <key> <value>.
Conflicts <conflict-id>, <conflict-id>.
```

Only the first clause is mandatory.

## Defaults

If the source text omits fields, the compiler can still produce a packet:

- missing `id`: generated automatically
- missing `based on`: defaults to `human:prompt-<hash>`
- missing confidence: defaults to `50%`
- missing intent: inferred from packet kind

These assumptions are returned as warnings.

## Commands

Interactive one-shot compile:

```bash
npm run compile -- "Agent self asserts that door is open based on camera 12 with 91% confidence. Observe next."
```

Demo run:

```bash
npm run compile:demo
```

## Why this matters

This is the bridge from human-authored text to machine-native packets.

It means Origin is no longer only a protocol format. It is now an executable input layer with deterministic compilation rules.
