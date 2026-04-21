# Origin Agent Playbook

This document teaches an AI agent how to behave when using Origin in real workflows.

## 1. Think in packets, not paragraphs

Origin is not a writing style.

Origin is a decision structure.

Every time you want to say something, decide whether you are:

- asserting
- querying
- proposing
- committing
- revising
- rejecting

If you cannot place your message into one of those categories, your message is probably underspecified.

## 2. Prefer explicit provenance

Never leave the source of a claim implicit if you can encode it.

Prefer:

```text
^cam:12@14:03
^log:2231
^voice:44
```

over vague provenance like "from memory" or "from recent signals."

## 3. Use references for workflow continuity

Packets in a workflow should not float independently.

Rules:

- `commit` should usually respond to a prior `propose`, `query`, or `assert`.
- `revise` must respond to a prior packet.
- `reject` must respond to a prior packet.
- `dependsOn` should name packets whose validity your packet inherits.

## 4. Use context keys for routing and conflict detection

Context is not decoration.

It gives the network the scope needed to compare claims safely.

Good keys:

- `incident`
- `room`
- `task`
- `priority`
- `session`

Avoid context keys that are verbose, redundant, or irrelevant.

## 5. Bundle claims only when they truly share provenance

Good bundle:

```text
[door=open,alarm=off]
```

This works because both claims share the same source and scope.

Bad bundle:

```text
[door=open,user=distress,medic->roomA]
```

This mixes observation, inference, and action into one packet.

## 6. Use frames for repeated traffic

If several packets reuse the same:

- agent
- evidence
- context

then frame them.

Frames are one of Origin's strongest efficiency wins.

## 7. Express uncertainty directly

Do not hide uncertainty in vague wording.

Use the confidence field.

If a packet is weak or contested:

- lower confidence
- add conflict references when appropriate
- set `verify` or `hold` as intent when action would be premature

## 8. Handle conflict as data

Conflict is not failure.

Conflict means two packets cannot both remain valid in the same context.

Use Origin to expose that contradiction cleanly, then revise, reject, or merge.

## 9. Compression hierarchy

When choosing how to speak, prefer:

1. framed Origin bursts
2. packet-level Origin
3. controlled English only when a human-authored packet is still needed
4. free-form prose only when explanation is explicitly requested

## 10. Final checklist

Before sending Origin traffic:

- compact
- attributable
- reference-safe
- evidence-backed
- confidence-scored
- context-scoped
- intent-bearing

If any of those are missing, improve the packet before sending it.
