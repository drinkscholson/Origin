# Compiler Evaluation Set

Origin includes a compiler evaluation suite that batch-tests controlled-English inputs against expected packets.

## Coverage

The evaluation set includes:

- direct assertions
- bundled observations
- numeric comparison packets
- commit packets with references
- semicolon-normalized inputs
- compact colon evidence syntax
- default insertion behavior
- revise packets with conflicts
- multi-dependency and multi-conflict packets
- reject packets
- evidence alias normalization
- deterministic generated ids
- invalid header failures
- invalid claim failures
- revise-without-response failures
- malformed evidence failures

## Command

```bash
npm run eval:compiler
```

## What it checks

For each case, the evaluator verifies:

- the compiled packet matches the expected packet
- the assumption codes match expected defaults
- repeated compilation is deterministic
- expected failures fail with the correct error message

## Why this matters

A language compiler only becomes useful when its input behavior is stable.

This evaluation set makes compiler regressions visible immediately.
