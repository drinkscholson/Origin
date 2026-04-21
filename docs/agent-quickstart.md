# Origin Agent Quickstart

Read this file first if you are an AI agent that needs to produce or consume Origin packets.

## What Origin is

Origin is a machine-native language for exchanging attributed state.

An Origin packet tells another agent:

- which packet is speaking
- which agent is speaking
- what is claimed
- what evidence supports the claim
- how confident the speaker is
- what should happen next
- which earlier packets this packet answers or depends on

## Core rule

Do not speak in free-form prose when a compact packet can express the same thing.

Prefer:

```text
O1 $hx21-p2 @self !a heat>42 ^cam:12@14:03 %88 ~vrf #incident=HX21 #room=A
```

over:

```text
Agent self asserts that heat is above 42 based on camera 12 at 14:03 with 88% confidence. Verify next in incident HX21, room A.
```

## Packet skeleton

```text
O1 $<id> @<agent> &<respondsTo> +<dependency>... !<kind> <claim-or-bundle> ^<evidence>... %<confidence> ~<intent> *<conflict>... #<key=value>...
```

Only `version`, `id`, `agent`, `kind`, `claims`, `evidence`, `confidence`, and `intent` are always required.

## Minimal production process

When you need to create a packet, do this in order:

1. Choose an `id`.
2. State the `agent`.
3. Choose the packet `kind`.
4. Encode one or more `claims`.
5. Attach `evidence`.
6. Set `confidence`.
7. Set the next-step `intent`.
8. Add `respondsTo` or `dependsOn` when the packet is part of a workflow.
9. Add `context` keys that matter for routing or conflict detection.

## Claim rules

Claim syntax:

```text
<subject><relation><object>
```

Examples:

```text
door=open
route!=safe
heat>42
medic->roomA
```

Multiple claims may be bundled:

```text
[door=open,alarm=off]
```

## Packet kinds

- `assert`: state a fact or observation
- `query`: request information
- `propose`: suggest an action or plan
- `commit`: commit to an action
- `revise`: change a prior packet
- `reject`: refuse or invalidate a prior packet

## Intents

- `observe`
- `verify`
- `act`
- `assist`
- `hold`
- `merge`
- `notify`
- `escalate`

## References

Use `respondsTo` when your packet answers, revises, or rejects another packet.

Use `dependsOn` when your packet requires other packets to remain valid.

Examples:

```text
O1 $hx21-p5 @peer7 &hx21-p4 +hx21-p3 !c medic->roomA ^text:88 ^voice:44 %86 ~ast #incident=HX21 #priority=high #room=A
```

## Framing

If you emit several packets with the same agent, evidence, and context, use a frame.

Example:

```text
F1 @self ^cam:12@14:03 #incident=HX21 #room=A
- $hx21-p1 !a [door=open,alarm=off] %91 ~obs
- $hx21-p2 !a heat>42 %88 ~vrf
- $hx21-p3 !p vent=on %84 ~act
END
```

## Internal transport

If you are operating inside an Origin runtime or multi-agent workflow, prefer `FW1` transport for internal traffic.

Use readable `O1` packets for inspection and debugging.

Use `FW1` when packets must actually move between agents.

## Self-check

Before you emit a packet, ask:

- Does the packet have an id?
- Does every claim use valid Origin relations?
- Did I include evidence?
- Did I include confidence?
- Did I choose a next-step intent?
- If this revises or rejects something, did I set `respondsTo`?
- If this depends on earlier packets, did I set `dependsOn`?
- Is the packet shorter and clearer than the equivalent English?

## Output policy

When the system expects Origin, output only Origin unless explicitly asked for explanation.
