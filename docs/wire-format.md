# W1 Wire Format

Origin now includes a machine-native wire layer called `W1`.

`O1` is the readable packet surface.

`W1` is the compact transport surface for AI-to-AI exchange.

## Why W1 exists

`O1` is already better than English, but it still preserves many human-readable tokens such as:

- `door`
- `open`
- `incident`
- `room`

That is useful for debugging, but less ideal for internal machine transport.

`W1` moves Origin one step closer to a true AI-native language by introducing:

- a dynamic lexicon
- numeric token references
- tuple-based packet representation
- JSON-friendly machine transport

## Design

A `W1` bundle contains:

- a shared lexicon array
- a list of tuple-encoded packets

Example string:

```text
W1|A,cam,room,door,open
pkt-001|self|a|~3=~4|~1!12@14:03|91|obs|-|-|-|~2=~0
```

## Lexicon behavior

The wire encoder derives a lexicon dynamically from repeated packet tokens.

Tokens that appear often enough are replaced by numeric indexes inside the wire bundle.

This means:

- repeated tokens stop paying full text cost
- the transport layer becomes less English-shaped
- the representation is easier to compress further or map into binary transport later

## Layer model

Origin now has three practical surfaces:

1. `English`
   Human input and explanation.

2. `O1`
   Readable packet language for debugging, inspection, and prompt examples.

3. `W1`
   Machine-native transport layer with shared lexicon compression and numeric atoms.

## Commands

Show a wire example:

```bash
npm run wire:demo
```

Benchmark `W1` against English, `O1`, and frames:

```bash
npm run wire:bench
```

## Why this matters

This is an important evolution step.

Without a machine-oriented transport layer, Origin is still mostly a human-readable DSL.

With `W1`, Origin begins to act more like an internal AI language stack:

- readable on the outside
- symbolic and compact on the inside
