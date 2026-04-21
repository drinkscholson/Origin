# Origin MVP Modules

This MVP is built from first principles.

The question is not "how do we make AI sound alien?"

The question is:

> What are the minimum modules required for machines to exchange state more efficiently than English?

## 1. Packet model

File: `src/model.ts`

Machines need a deterministic unit of meaning.

The packet is that unit. It separates:

- which packet is speaking
- who is speaking
- what is claimed
- what evidence supports it
- how confident the speaker is
- what the listener should do next
- which earlier packets it references

Without this layer, every later optimization is cosmetic.

## 2. Codec

File: `src/codec.ts`

Machines need a stable surface syntax.

The Origin codec turns a packet into a compact DSL such as:

```text
O1 @self !a heat>42 ^cam:12@14:03 %88 ~vrf #incident=HX21 #room=A
```

This is where English loses ground:

- no filler words
- no flexible sentence order
- symbolic relations instead of helper phrases
- explicit provenance instead of implied provenance
- reply-by-id instead of quote-by-content

## 3. Diagnostics

File: `src/diagnostics.ts`

Machines need quality control.

The diagnostics module catches message patterns that make agent coordination worse, for example:

- low-confidence claims without conflict markers
- oversized packets
- duplicate evidence
- repeated bursts that should be compressed into a frame

This is important because a language is not useful just because it is short. It must also guide agents toward cleaner communication behavior.

## 4. Shared frame compression

File: `src/frame.ts`

Machines often send bursts of related packets under the same source and context.

English repeats that context every time.

Origin frames lift shared fields into one header:

```text
F1 @self ^cam:12@14:03 #incident=HX21 #room=A
- !a [door=open,alarm=off] %91 ~obs
- !a heat>42 %88 ~vrf
- !p vent=on %84 ~act
END
```

This is the first true session-level optimization in the MVP.

## 5. Workflow layer

Files: `src/workflow.ts`, `src/workflows.ts`

A language MVP must prove itself inside a task, not just in one-liners.

The workflow layer models a multi-step incident response burst and measures:

- English transmission size
- packet-level Origin size
- frame-level Origin size
- packet diagnostics along the way
- reference integrity
- derived conflicts from incompatible claims

## 6. MVP runner

File: `src/mvp.ts`

The runner makes the whole system inspectable from the terminal.

It prints:

- each workflow step in English and Origin
- diagnostics per step
- frame-compressed output
- reference graph health
- derived conflicts
- efficiency gains
- frame roundtrip verification

## Current outcome

On the bundled incident-response scenario, the current MVP shows:

- packet-level Origin savings over English
- additional savings from frame-level compression
- deterministic roundtrip parsing for frames

That is enough to qualify as a real language MVP: structured, compressible, verifiable, and runnable.
