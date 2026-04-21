# Origin v0.1.1 Roadmap

`v0.1.1` should be a hardening release.

The purpose of this version is not to change the identity of Origin.

The purpose is to make the `v0.1.0` stack easier to evaluate, easier to package, and easier to extend.

## Goals

### 1. Runtime hardening

- expand the deterministic runtime beyond the current coordinator, safety, and dispatch loop
- add richer agent branching behaviors
- add runtime regression scenarios
- preserve `FW1` as the default internal transport path

### 2. Corpus growth

- add more repeated workflow families
- add more mixed workloads where `FW1` must choose between lexicon and frame-only modes
- keep the corpus benchmark deterministic

### 3. Compiler expansion

- widen controlled-English coverage without breaking deterministic behavior
- add more compiler evaluation cases
- document unsupported patterns more clearly

### 4. Release quality

- standardize release notes and packaging
- add a release asset build step
- add checksums and a structured release manifest

### 5. Protocol clarity

- document compatibility expectations for `O1`, `W1`, and `FW1`
- define upgrade assumptions more explicitly
- make transport-layer tradeoffs easier to inspect

## Recommended Deliverables

- at least one new runtime scenario
- at least one new transport-heavy corpus family
- a larger compiler evaluation set
- a documented release packaging workflow
- a compatibility note for `FW1`

## Suggested Exit Criteria

`v0.1.1` is ready when:

- the runtime still roundtrips cleanly through `FW1`
- the corpus benchmark covers both `frame-only` and `lexicon` `FW1` modes
- the release process can generate a clean asset bundle in one pass
- docs, runtime behavior, and release notes describe the same current state
