import { canonicalizePacket, estimateUtf8Bytes, validatePacket } from "./codec.js";
import {
  groupPacketsIntoFrames,
  materializeFrame,
} from "./frame.js";
import type {
  OriginFrame,
  OriginFrameEntry,
  OriginFrameHeader,
} from "./frame.js";
import type { OriginContext, OriginPacket } from "./model.js";
import {
  CODE_TO_INTENT,
  CODE_TO_KIND,
  INTENT_TO_CODE,
  KIND_TO_CODE,
} from "./vocabulary.js";

export type OriginFrameWireAtom = number | string;

export type OriginFrameWireClaim = [
  OriginFrameWireAtom,
  OriginPacket["claims"][number]["relation"],
  OriginFrameWireAtom,
];

export type OriginFrameWireEvidence = [OriginFrameWireAtom, OriginFrameWireAtom];
export type OriginFrameWireContextEntry = [OriginFrameWireAtom, OriginFrameWireAtom];
export type OriginFrameWireReferenceList = OriginFrameWireAtom[] | null;

export type OriginFrameWireHeader = [
  agent: OriginFrameWireAtom | null,
  evidence: OriginFrameWireEvidence[] | null,
  context: OriginFrameWireContextEntry[] | null,
];

export type OriginFrameWireEntry = [
  id: OriginFrameWireAtom,
  agent: OriginFrameWireAtom | null,
  kindCode: string,
  claims: OriginFrameWireClaim[],
  evidence: OriginFrameWireEvidence[] | null,
  confidencePercent: number,
  intentCode: string,
  respondsTo: OriginFrameWireAtom | null,
  dependsOn: OriginFrameWireReferenceList,
  conflicts: OriginFrameWireReferenceList,
  context: OriginFrameWireContextEntry[] | null,
];

export interface OriginFrameWireFrame {
  header: OriginFrameWireHeader;
  entries: OriginFrameWireEntry[];
}

export interface OriginFrameWireBundle {
  version: "FW1";
  lexicon: string[];
  frames: OriginFrameWireFrame[];
}

export interface OriginFrameWireLexiconOptions {
  minFrequency?: number;
}

const CLAIM_OPERATORS: OriginPacket["claims"][number]["relation"][] = [
  "!=",
  ">=",
  "<=",
  "->",
  "=",
  ">",
  "<",
];

export function deriveFrameWireLexicon(
  packets: OriginPacket[],
  options: OriginFrameWireLexiconOptions = {},
): string[] {
  const minFrequency = options.minFrequency ?? 2;
  const counts = new Map<string, number>();

  for (const packet of packets.map(canonicalizePacket)) {
    bump(counts, packet.id);
    bump(counts, packet.agent);

    for (const claim of packet.claims) {
      bump(counts, claim.subject);
      bump(counts, claim.object);
    }

    for (const evidence of packet.evidence) {
      bump(counts, evidence.kind);
      bump(counts, evidence.ref);
    }

    if (packet.respondsTo) {
      bump(counts, packet.respondsTo);
    }

    for (const dependency of packet.dependsOn ?? []) {
      bump(counts, dependency);
    }

    for (const conflict of packet.conflicts ?? []) {
      bump(counts, conflict);
    }

    for (const [key, value] of Object.entries(packet.context ?? {})) {
      bump(counts, key);
      bump(counts, value);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minFrequency)
    .sort((left, right) => {
      const byCount = right[1] - left[1];
      return byCount !== 0 ? byCount : left[0].localeCompare(right[0]);
    })
    .map(([token]) => token);
}

export function encodeFrameWireBundle(
  packets: OriginPacket[],
  options: OriginFrameWireLexiconOptions = {},
): OriginFrameWireBundle {
  const normalizedPackets = packets.map(canonicalizePacket);
  const frames = groupPacketsIntoFrames(normalizedPackets);
  const lexicon =
    options.minFrequency === undefined
      ? selectOptimalFrameWireLexicon(normalizedPackets, frames)
      : deriveFrameWireLexicon(normalizedPackets, options);

  return buildFrameWireBundle(frames, lexicon);
}

export function decodeFrameWireBundle(bundle: OriginFrameWireBundle): OriginPacket[] {
  if (bundle.version !== "FW1") {
    throw new Error(`Unsupported frame-wire bundle version: ${bundle.version}`);
  }

  return bundle.frames.flatMap((frame) =>
    materializeFrame(decodeFrameWireFrame(frame, bundle.lexicon)).map((packet) => {
      const normalized = canonicalizePacket(packet);
      validatePacket(normalized);
      return normalized;
    }),
  );
}

export function encodeFrameWireFrame(
  frame: OriginFrame,
  lexiconIndex: Map<string, number>,
): OriginFrameWireFrame {
  return {
    header: encodeFrameWireHeader(frame.header, lexiconIndex),
    entries: frame.entries.map((entry) => encodeFrameWireEntry(entry, lexiconIndex)),
  };
}

export function decodeFrameWireFrame(
  frame: OriginFrameWireFrame,
  lexicon: string[],
): OriginFrame {
  return {
    version: "F1",
    header: decodeFrameWireHeader(frame.header, lexicon),
    entries: frame.entries.map((entry) => decodeFrameWireEntry(entry, lexicon)),
  };
}

export function encodeFrameWireString(bundle: OriginFrameWireBundle): string {
  const lines = [bundle.lexicon.length > 0 ? `FW1|${bundle.lexicon.join(",")}` : "FW1"];

  for (const frame of bundle.frames) {
    lines.push(encodeFrameWireHeaderLine(frame.header));

    for (const entry of frame.entries) {
      lines.push(encodeFrameWireEntryLine(entry));
    }

    lines.push(".");
  }

  return lines.join("\n");
}

export function parseFrameWireString(input: string): OriginFrameWireBundle {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 1) {
    throw new Error("Frame-wire string cannot be empty.");
  }

  const [bundleHeader, ...rest] = lines;
  const [version, rawLexicon] = bundleHeader.includes("|")
    ? bundleHeader.split("|", 2)
    : [bundleHeader, undefined];

  if (version !== "FW1") {
    throw new Error(`Unsupported frame-wire string version: ${version}`);
  }

  const lexicon = !rawLexicon ? [] : rawLexicon.split(",");
  const frames: OriginFrameWireFrame[] = [];
  let index = 0;

  while (index < rest.length) {
    const headerLine = rest[index];

    if (!headerLine.startsWith("=")) {
      throw new Error(`Invalid frame-wire header line: ${headerLine}`);
    }

    index += 1;
    const entries: OriginFrameWireEntry[] = [];

    while (index < rest.length && rest[index] !== ".") {
      entries.push(parseFrameWireEntryLine(rest[index]));
      index += 1;
    }

    if (index >= rest.length || rest[index] !== ".") {
      throw new Error("Frame-wire frame must terminate with a dot line.");
    }

    frames.push({
      header: parseFrameWireHeaderLine(headerLine),
      entries,
    });
    index += 1;
  }

  return {
    version: "FW1",
    lexicon,
    frames,
  };
}

export function estimateFrameWireBytes(bundle: OriginFrameWireBundle): number {
  return estimateUtf8Bytes(encodeFrameWireString(bundle));
}

function buildFrameWireBundle(
  frames: OriginFrame[],
  lexicon: string[],
): OriginFrameWireBundle {
  const lexiconIndex = new Map(lexicon.map((token, index) => [token, index]));

  return {
    version: "FW1",
    lexicon,
    frames: frames.map((frame) => encodeFrameWireFrame(frame, lexiconIndex)),
  };
}

function encodeFrameWireHeader(
  header: OriginFrameHeader,
  lexiconIndex: Map<string, number>,
): OriginFrameWireHeader {
  return [
    header.agent ? encodeFrameWireAtom(header.agent, lexiconIndex) : null,
    encodeFrameWireEvidenceList(header.evidence, lexiconIndex),
    encodeFrameWireContext(header.context, lexiconIndex),
  ];
}

function decodeFrameWireHeader(
  header: OriginFrameWireHeader,
  lexicon: string[],
): OriginFrameHeader {
  const [agent, evidence, context] = header;

  return {
    agent: agent === null ? undefined : decodeFrameWireAtom(agent, lexicon),
    evidence: decodeFrameWireEvidenceList(evidence, lexicon),
    context: decodeFrameWireContext(context, lexicon),
  };
}

function encodeFrameWireEntry(
  entry: OriginFrameEntry,
  lexiconIndex: Map<string, number>,
): OriginFrameWireEntry {
  return [
    encodeFrameWireAtom(entry.id, lexiconIndex),
    entry.agent ? encodeFrameWireAtom(entry.agent, lexiconIndex) : null,
    KIND_TO_CODE[entry.kind],
    entry.claims.map((claim) => [
      encodeFrameWireAtom(claim.subject, lexiconIndex),
      claim.relation,
      encodeFrameWireAtom(claim.object, lexiconIndex),
    ]),
    encodeFrameWireEvidenceList(entry.evidence, lexiconIndex),
    Math.round(entry.confidence * 100),
    INTENT_TO_CODE[entry.intent],
    entry.respondsTo ? encodeFrameWireAtom(entry.respondsTo, lexiconIndex) : null,
    encodeFrameWireReferenceList(entry.dependsOn, lexiconIndex),
    encodeFrameWireReferenceList(entry.conflicts, lexiconIndex),
    encodeFrameWireContext(entry.context, lexiconIndex),
  ];
}

function decodeFrameWireEntry(
  entry: OriginFrameWireEntry,
  lexicon: string[],
): OriginFrameEntry {
  const [
    id,
    agent,
    kindCode,
    claims,
    evidence,
    confidencePercent,
    intentCode,
    respondsTo,
    dependsOn,
    conflicts,
    context,
  ] = entry;

  return {
    id: decodeFrameWireAtom(id, lexicon),
    agent: agent === null ? undefined : decodeFrameWireAtom(agent, lexicon),
    kind: decodeCode(kindCode, CODE_TO_KIND as Record<string, OriginPacket["kind"]>, "kind"),
    claims: claims.map(([subject, relation, object]) => ({
      subject: decodeFrameWireAtom(subject, lexicon),
      relation,
      object: decodeFrameWireAtom(object, lexicon),
    })),
    evidence: decodeFrameWireEvidenceList(evidence, lexicon),
    confidence: confidencePercent / 100,
    intent: decodeCode(
      intentCode,
      CODE_TO_INTENT as Record<string, OriginPacket["intent"]>,
      "intent",
    ),
    respondsTo: respondsTo === null ? undefined : decodeFrameWireAtom(respondsTo, lexicon),
    dependsOn: decodeFrameWireReferenceList(dependsOn, lexicon),
    conflicts: decodeFrameWireReferenceList(conflicts, lexicon),
    context: decodeFrameWireContext(context, lexicon),
  };
}

function encodeFrameWireHeaderLine(header: OriginFrameWireHeader): string {
  const [agent, evidence, context] = header;
  const tokens = ["="];

  if (agent !== null) {
    tokens.push(`@${serializeAtom(agent)}`);
  }

  for (const item of evidence ?? []) {
    tokens.push(`^${serializeAtom(item[0])}!${serializeAtom(item[1])}`);
  }

  for (const [key, value] of context ?? []) {
    tokens.push(`#${serializeAtom(key)}=${serializeAtom(value)}`);
  }

  return tokens.join(" ");
}

function parseFrameWireHeaderLine(line: string): OriginFrameWireHeader {
  const tokens = tokenize(line);

  if (tokens[0] !== "=") {
    throw new Error(`Invalid frame-wire header line: ${line}`);
  }

  let agent: OriginFrameWireAtom | null = null;
  const evidence: OriginFrameWireEvidence[] = [];
  const context: OriginFrameWireContextEntry[] = [];

  for (const token of tokens.slice(1)) {
    if (token.startsWith("@")) {
      agent = parseAtom(token.slice(1));
      continue;
    }

    if (token.startsWith("^")) {
      evidence.push(parseEvidenceToken(token.slice(1)));
      continue;
    }

    if (token.startsWith("#")) {
      context.push(parseContextToken(token.slice(1)));
      continue;
    }

    throw new Error(`Invalid frame-wire header token: ${token}`);
  }

  return [agent, evidence.length > 0 ? evidence : null, context.length > 0 ? context : null];
}

function encodeFrameWireEntryLine(entry: OriginFrameWireEntry): string {
  const [
    id,
    agent,
    kindCode,
    claims,
    evidence,
    confidencePercent,
    intentCode,
    respondsTo,
    dependsOn,
    conflicts,
    context,
  ] = entry;

  const tokens = ["-", `$${serializeAtom(id)}`];

  if (agent !== null) {
    tokens.push(`@${serializeAtom(agent)}`);
  }

  if (respondsTo !== null) {
    tokens.push(`&${serializeAtom(respondsTo)}`);
  }

  for (const dependency of dependsOn ?? []) {
    tokens.push(`+${serializeAtom(dependency)}`);
  }

  tokens.push(`!${kindCode}`);
  tokens.push(encodeFrameWireClaims(claims));

  for (const item of evidence ?? []) {
    tokens.push(`^${serializeAtom(item[0])}!${serializeAtom(item[1])}`);
  }

  tokens.push(`%${confidencePercent}`);
  tokens.push(`~${intentCode}`);

  for (const conflict of conflicts ?? []) {
    tokens.push(`*${serializeAtom(conflict)}`);
  }

  for (const [key, value] of context ?? []) {
    tokens.push(`#${serializeAtom(key)}=${serializeAtom(value)}`);
  }

  return tokens.join(" ");
}

function parseFrameWireEntryLine(line: string): OriginFrameWireEntry {
  const tokens = tokenize(line);

  if (tokens[0] !== "-") {
    throw new Error(`Invalid frame-wire entry line: ${line}`);
  }

  let id: OriginFrameWireAtom | null = null;
  let agent: OriginFrameWireAtom | null = null;
  let kindCode = "";
  let confidencePercent = 100;
  let intentCode = "";
  let respondsTo: OriginFrameWireAtom | null = null;
  const claims: OriginFrameWireClaim[] = [];
  const evidence: OriginFrameWireEvidence[] = [];
  const dependsOn: OriginFrameWireAtom[] = [];
  const conflicts: OriginFrameWireAtom[] = [];
  const context: OriginFrameWireContextEntry[] = [];

  for (const token of tokens.slice(1)) {
    if (token.startsWith("$")) {
      id = parseAtom(token.slice(1));
      continue;
    }

    if (token.startsWith("@")) {
      agent = parseAtom(token.slice(1));
      continue;
    }

    if (token.startsWith("&")) {
      respondsTo = parseAtom(token.slice(1));
      continue;
    }

    if (token.startsWith("+")) {
      dependsOn.push(parseAtom(token.slice(1)));
      continue;
    }

    if (token.startsWith("!")) {
      kindCode = token.slice(1);
      continue;
    }

    if (token.startsWith("^")) {
      evidence.push(parseEvidenceToken(token.slice(1)));
      continue;
    }

    if (token.startsWith("%")) {
      confidencePercent = Number(token.slice(1));
      continue;
    }

    if (token.startsWith("~")) {
      const candidate = token.slice(1);

      if (candidate in CODE_TO_INTENT) {
        intentCode = candidate;
        continue;
      }
    }

    if (token.startsWith("*")) {
      conflicts.push(parseAtom(token.slice(1)));
      continue;
    }

    if (token.startsWith("#")) {
      context.push(parseContextToken(token.slice(1)));
      continue;
    }

    if (token.startsWith("[") && token.endsWith("]")) {
      const bundle = token.slice(1, -1);

      for (const claim of bundle.split(",")) {
        claims.push(parseFrameWireClaim(claim));
      }

      continue;
    }

    claims.push(parseFrameWireClaim(token));
  }

  if (id === null) {
    throw new Error(`Frame-wire entry requires an id: ${line}`);
  }

  return [
    id,
    agent,
    kindCode,
    claims,
    evidence.length > 0 ? evidence : null,
    confidencePercent,
    intentCode,
    respondsTo,
    dependsOn.length > 0 ? dependsOn : null,
    conflicts.length > 0 ? conflicts : null,
    context.length > 0 ? context : null,
  ];
}

function encodeFrameWireEvidenceList(
  evidence: OriginFrameHeader["evidence"] | OriginFrameEntry["evidence"],
  lexiconIndex: Map<string, number>,
): OriginFrameWireEvidence[] | null {
  if (!evidence || evidence.length === 0) {
    return null;
  }

  return evidence.map((item) => [
    encodeFrameWireAtom(item.kind, lexiconIndex),
    encodeFrameWireAtom(item.ref, lexiconIndex),
  ]);
}

function decodeFrameWireEvidenceList(
  evidence: OriginFrameWireEvidence[] | null,
  lexicon: string[],
): OriginFrameHeader["evidence"] | OriginFrameEntry["evidence"] {
  if (!evidence || evidence.length === 0) {
    return undefined;
  }

  return evidence.map(([kind, ref]) => ({
    kind: decodeFrameWireAtom(kind, lexicon),
    ref: decodeFrameWireAtom(ref, lexicon),
  }));
}

function encodeFrameWireContext(
  context: OriginContext | undefined,
  lexiconIndex: Map<string, number>,
): OriginFrameWireContextEntry[] | null {
  if (!context || Object.keys(context).length === 0) {
    return null;
  }

  return Object.entries(context).map(([key, value]) => [
    encodeFrameWireAtom(key, lexiconIndex),
    encodeFrameWireAtom(value, lexiconIndex),
  ]);
}

function decodeFrameWireContext(
  context: OriginFrameWireContextEntry[] | null,
  lexicon: string[],
): OriginContext | undefined {
  if (!context || context.length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    context.map(([key, value]) => [
      decodeFrameWireAtom(key, lexicon),
      decodeFrameWireAtom(value, lexicon),
    ]),
  );
}

function encodeFrameWireReferenceList(
  values: string[] | undefined,
  lexiconIndex: Map<string, number>,
): OriginFrameWireReferenceList {
  if (!values || values.length === 0) {
    return null;
  }

  return values.map((value) => encodeFrameWireAtom(value, lexiconIndex));
}

function decodeFrameWireReferenceList(
  values: OriginFrameWireReferenceList,
  lexicon: string[],
): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return values.map((value) => decodeFrameWireAtom(value, lexicon));
}

function serializeAtom(value: OriginFrameWireAtom | null): string {
  if (value === null) {
    return "-";
  }

  return typeof value === "number" ? `~${value}` : value;
}

function parseAtom(value: string): OriginFrameWireAtom {
  if (/^~\d+$/.test(value)) {
    return Number(value.slice(1));
  }

  return value;
}

function serializeEvidenceList(values: OriginFrameWireEvidence[] | null): string {
  if (!values || values.length === 0) {
    return "-";
  }

  return values.map(([kind, ref]) => `${serializeAtom(kind)}!${serializeAtom(ref)}`).join(",");
}

function parseEvidenceList(value: string): OriginFrameWireEvidence[] | null {
  if (value === "-") {
    return null;
  }

  return value.split(",").map((evidence) => {
    const separator = evidence.indexOf("!");

    if (separator <= 0) {
      throw new Error(`Invalid frame-wire evidence: ${evidence}`);
    }

    return [
      parseAtom(evidence.slice(0, separator)),
      parseAtom(evidence.slice(separator + 1)),
    ];
  });
}

function serializeReferenceList(values: OriginFrameWireReferenceList): string {
  return values && values.length > 0 ? values.map(serializeAtom).join(",") : "-";
}

function parseReferenceList(value: string): OriginFrameWireReferenceList {
  return value === "-" ? null : value.split(",").filter(Boolean).map(parseAtom);
}

function serializeContextEntries(context: OriginFrameWireContextEntry[] | null): string {
  if (!context || context.length === 0) {
    return "-";
  }

  return context.map(([key, value]) => `${serializeAtom(key)}=${serializeAtom(value)}`).join(",");
}

function parseContextEntries(value: string): OriginFrameWireContextEntry[] | null {
  if (value === "-") {
    return null;
  }

  return value.split(",").map((entry) => {
    const separator = entry.indexOf("=");

    if (separator <= 0) {
      throw new Error(`Invalid frame-wire context entry: ${entry}`);
    }

    return [
      parseAtom(entry.slice(0, separator)),
      parseAtom(entry.slice(separator + 1)),
    ];
  });
}

function parseFrameWireClaim(claim: string): OriginFrameWireClaim {
  for (const operator of CLAIM_OPERATORS) {
    const index = claim.indexOf(operator);

    if (index > 0) {
      return [
        parseAtom(claim.slice(0, index)),
        operator,
        parseAtom(claim.slice(index + operator.length)),
      ];
    }
  }

  throw new Error(`Invalid frame-wire claim: ${claim}`);
}

function parseEvidenceToken(token: string): OriginFrameWireEvidence {
  const separator = token.indexOf("!");

  if (separator <= 0) {
    throw new Error(`Invalid frame-wire evidence token: ${token}`);
  }

  return [parseAtom(token.slice(0, separator)), parseAtom(token.slice(separator + 1))];
}

function parseContextToken(token: string): OriginFrameWireContextEntry {
  const separator = token.indexOf("=");

  if (separator <= 0) {
    throw new Error(`Invalid frame-wire context token: ${token}`);
  }

  return [parseAtom(token.slice(0, separator)), parseAtom(token.slice(separator + 1))];
}

function encodeFrameWireClaims(claims: OriginFrameWireClaim[]): string {
  if (claims.length === 1) {
    const [subject, relation, object] = claims[0];
    return `${serializeAtom(subject)}${relation}${serializeAtom(object)}`;
  }

  return `[${claims.map(([subject, relation, object]) => `${serializeAtom(subject)}${relation}${serializeAtom(object)}`).join(",")}]`;
}

function encodeFrameWireAtom(
  value: string,
  lexiconIndex: Map<string, number>,
): OriginFrameWireAtom {
  return lexiconIndex.get(value) ?? value;
}

function decodeFrameWireAtom(value: OriginFrameWireAtom, lexicon: string[]): string {
  if (typeof value === "number") {
    const resolved = lexicon[value];

    if (resolved === undefined) {
      throw new Error(`Invalid frame-wire lexicon index: ${value}`);
    }

    return resolved;
  }

  return value;
}

function decodeCode<TValue extends string>(
  raw: string,
  map: Record<string, TValue>,
  label: string,
): TValue {
  const resolved = map[raw];

  if (!resolved) {
    throw new Error(`Unknown ${label} code: ${raw}`);
  }

  return resolved;
}

function bump(counts: Map<string, number>, token: string): void {
  counts.set(token, (counts.get(token) ?? 0) + 1);
}

function selectOptimalFrameWireLexicon(
  packets: OriginPacket[],
  frames: OriginFrame[],
): string[] {
  const counts = new Map<string, number>();

  for (const packet of packets) {
    bumpFrameWireCounts(counts, packet);
  }

  const thresholds = [...new Set([...counts.values()].filter((count) => count >= 2))].sort(
    (left, right) => left - right,
  );
  const candidates = [
    [],
    ...thresholds.map((minFrequency) => deriveFrameWireLexicon(packets, { minFrequency })),
  ];

  let bestLexicon = candidates[0];
  let bestBytes = estimateFrameWireBytes(buildFrameWireBundle(frames, bestLexicon));

  for (const candidate of candidates.slice(1)) {
    const bytes = estimateFrameWireBytes(buildFrameWireBundle(frames, candidate));

    if (bytes < bestBytes || (bytes === bestBytes && candidate.length < bestLexicon.length)) {
      bestLexicon = candidate;
      bestBytes = bytes;
    }
  }

  return bestLexicon;
}

function bumpFrameWireCounts(counts: Map<string, number>, packet: OriginPacket): void {
  bump(counts, packet.id);
  bump(counts, packet.agent);

  for (const claim of packet.claims) {
    bump(counts, claim.subject);
    bump(counts, claim.object);
  }

  for (const evidence of packet.evidence) {
    bump(counts, evidence.kind);
    bump(counts, evidence.ref);
  }

  if (packet.respondsTo) {
    bump(counts, packet.respondsTo);
  }

  for (const dependency of packet.dependsOn ?? []) {
    bump(counts, dependency);
  }

  for (const conflict of packet.conflicts ?? []) {
    bump(counts, conflict);
  }

  for (const [key, value] of Object.entries(packet.context ?? {})) {
    bump(counts, key);
    bump(counts, value);
  }
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let claimDepth = 0;

  for (const char of input) {
    if (char === "[" && claimDepth === 0) {
      claimDepth += 1;
      current += char;
      continue;
    }

    if (char === "]" && claimDepth > 0) {
      claimDepth -= 1;
      current += char;
      continue;
    }

    if (char === " " && claimDepth === 0) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
