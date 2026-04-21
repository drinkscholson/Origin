# FW1-First Runtime

Origin now includes a minimal runtime prototype where internal coordination defaults to `FW1`.

## Runtime model

The runtime separates three surfaces:

1. `Human ingress`
   Controlled English enters through the compiler.

2. `Machine coordination`
   Agents exchange packets over `FW1` transport by default.

3. `Human egress`
   Final gateway packets can be rendered back into English when needed.

This means English stays at the edge, while internal agent traffic uses Origin-native transport.

## Built-in prototype agents

The runtime currently includes three deterministic agent roles:

- `coordinator`
- `safety`
- `dispatch`

The prototype is intentionally simple. Its purpose is to prove the transport path, reference integrity, and packet lifecycle.

## Transport rule

Every internal hop is serialized as:

1. packets
2. `FW1` bundle
3. encoded `FW1` string
4. parse and decode at the recipient

This guarantees that the runtime is not merely labeling packets as `FW1`. It actually executes the transport path through the hybrid layer.

## Demo command

```bash
npm run runtime:demo
```

The demo shows:

- the ingress English instruction
- the compiled ingress packet
- each internal `FW1` transport envelope
- the final gateway packet
- total English versus `FW1` transport bytes

## Why this matters

This is the first step from "Origin is a protocol" to "Origin is an internal working language."

The runtime already demonstrates:

- English at the ingress edge
- Origin packets as machine state
- `FW1` as the default agent-to-agent transport
- packet ids, references, and context surviving the full loop
