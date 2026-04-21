# FW1 Hybrid Format

`FW1` is the hybrid transport layer for Origin.

It combines:

- `F1` frame-level shared headers
- `W1` style machine-oriented atom encoding
- adaptive lexicon selection
- compact workflow references

## Why FW1 exists

`F1` is very strong when many packets share the same agent, evidence, and context.

`W1` is strong when repeated tokens can be replaced by lexicon indexes.

`FW1` combines both ideas and lets the encoder choose whether a lexicon is worth the header cost for a given workload.

This makes `FW1` the closest current layer to an internal AI transport language in the repository:

- frame-aware
- reference-aware
- machine-oriented
- compression-adaptive

## Design

A `FW1` bundle contains:

- a bundle version
- an optional lexicon
- one or more frame groups
- compact entry lines inside each frame

Example bundle:

```text
FW1
= @peer7 ^text!88 ^voice!44 #incident=HX21 #priority=high #room=A
- $hx21-p4 !a user=distress %83 ~ntf
- $hx21-p5 &hx21-p4 +hx21-p3 !c medic->roomA %86 ~ast
- $hx21-p6 &hx21-p5 !a corridor=blocked %61 ~vrf
- $hx21-p7 &hx21-p5 +hx21-p6 !r medic->serviceEntry %78 ~ast
.
```

## Adaptive lexicon behavior

`FW1` does not force a lexicon for every workload.

The default encoder evaluates multiple lexicon thresholds and may choose:

- a dense lexicon for large, repetitive workflows
- a small lexicon for mixed workloads
- an empty lexicon when frame sharing already produces the best result

This is intentional.

The goal is not to maximize symbol count. The goal is to minimize transport cost while preserving deterministic roundtrip behavior.

## Layer model

Origin now has four practical surfaces:

1. `English`
   Human input and explanation.

2. `O1`
   Readable packet language.

3. `W1`
   Machine-native wire bundle with lexicon compression.

4. `FW1`
   Frame-aware hybrid transport that combines shared headers, compact references, and optional lexicon atoms.

## Commands

Show the hybrid bundle:

```bash
npm run fw:demo
```

Benchmark `FW1` against English, `O1`, `F1`, and `W1`:

```bash
npm run fw:bench
```

Benchmark `FW1` across the larger workflow corpus:

```bash
npm run corpus:bench
```

## Why this matters

`FW1` is the first layer in the repository that adapts its transport strategy to the workload itself.

That moves Origin closer to a true internal AI language stack:

- English at the human edge
- readable packets for inspection
- adaptive hybrid transport inside machine workflows

The runtime prototype now uses `FW1` as its default internal transport.
