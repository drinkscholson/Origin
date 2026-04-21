# Origin v0.1 Specification

Origin is a compact language for machine-to-machine state exchange.

Its goal is not poetic expression. Its goal is to minimize ambiguity and communication cost while preserving attribution.

## Design target

English is inefficient for agents because it spends many bytes on:

- filler words
- flexible word order
- implied source tracking
- repeated context
- mixed statement and intent

Origin compresses the same information by making provenance part of the grammar.

## Packet model

Every packet contains:

- `version`
- `id`
- `agent`
- `kind`
- `claims`
- `evidence`
- `confidence`
- `intent`
- optional `respondsTo`
- optional `dependsOn`
- optional `conflicts`
- optional `context`

## Efficiency strategy

Origin improves over English through:

1. slot-based syntax instead of natural-language word order
2. short opcode dictionaries such as `!a` for `assert`
3. symbolic relations such as `=` and `!=`
4. bundled claims inside one packet
5. inherited evidence and context for the full packet
6. numeric confidence instead of narrative hedging
7. packet ids and reply references instead of repeated quote-by-content behavior

## Surface syntax

```text
O1 $<id> @<agent> &<respondsTo> +<dependency>... !<kind> <claim-or-bundle> ^<evidence>... %<confidence> ~<intent> *<conflict>... #<key=value>...
```

### Field markers

- `O1`: protocol version
- `$`: packet id
- `@`: speaking agent
- `&`: reply or revision target
- `+`: dependency reference
- `!`: packet kind code
- `^`: evidence entry
- `%`: confidence from `0-100`
- `~`: intent code
- `*`: conflict id
- `#`: context key/value

### Claim syntax

Single claim:

```text
door=open
```

Bundled claims:

```text
[door=open,alarm=off]
```

Supported relations:

- `=`
- `!=`
- `>`
- `<`
- `>=`
- `<=`
- `->`

## Vocabulary

### Kind codes

- `a`: assert
- `q`: query
- `p`: propose
- `c`: commit
- `r`: revise
- `x`: reject

### Intent codes

- `obs`: observe
- `vrf`: verify
- `act`: act
- `ast`: assist
- `hld`: hold
- `mrg`: merge
- `ntf`: notify
- `esl`: escalate

## Example

English:

```text
Agent self asserts that the door is open and the alarm is off based on camera 12 at 14:03 with 91% confidence. Observe next in room A.
```

Origin:

```text
O1 $pkt-001 @self !a [door=open,alarm=off] ^cam:12@14:03 %91 ~obs #room=A
```

## Why this matters

The packet is shorter because it removes English scaffolding while keeping:

- who said it
- which packet said it
- what is claimed
- why it is believed
- how strongly it is believed
- what should happen next
- which earlier packets it anchors to

That is the foundation for an actually usable AI language.
