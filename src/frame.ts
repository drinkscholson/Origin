import { encodePacket, parsePacket } from "./codec.js";
import type {
  OriginContext,
  OriginEvidence,
  OriginIntent,
  OriginKind,
  OriginPacket,
} from "./model.js";
import { INTENT_TO_CODE, KIND_TO_CODE } from "./vocabulary.js";

export interface OriginFrameHeader {
  agent?: string;
  evidence?: OriginEvidence[];
  context?: OriginContext;
}

export interface OriginFrameEntry {
  id: string;
  agent?: string;
  kind: OriginKind;
  claims: OriginPacket["claims"];
  evidence?: OriginEvidence[];
  confidence: number;
  intent: OriginIntent;
  respondsTo?: string;
  dependsOn?: string[];
  conflicts?: string[];
  context?: OriginContext;
}

export interface OriginFrame {
  version: "F1";
  header: OriginFrameHeader;
  entries: OriginFrameEntry[];
}

export function buildFrameFromPackets(packets: OriginPacket[]): OriginFrame {
  if (packets.length === 0) {
    throw new Error("Cannot build a frame from zero packets.");
  }

  const header = findSharedHeader(packets);
  const entries = packets.map((packet) => toFrameEntry(packet, header));

  return {
    version: "F1",
    header,
    entries,
  };
}

export function materializeFrame(frame: OriginFrame): OriginPacket[] {
  return frame.entries.map((entry) => ({
    version: "O1",
    id: entry.id,
    agent: entry.agent ?? frame.header.agent ?? "",
    kind: entry.kind,
    claims: entry.claims,
    evidence: [...(frame.header.evidence ?? []), ...(entry.evidence ?? [])],
    confidence: entry.confidence,
    intent: entry.intent,
    respondsTo: entry.respondsTo,
    dependsOn: entry.dependsOn,
    conflicts: entry.conflicts,
    context: mergeContext(frame.header.context, entry.context),
  }));
}

export function encodeFrame(frame: OriginFrame): string {
  const lines: string[] = [];
  const headerTokens = [
    frame.version,
    ...(frame.header.agent ? [`@${frame.header.agent}`] : []),
    ...(frame.header.evidence ?? []).map((item) => `^${item.kind}:${item.ref}`),
    ...encodeContext(frame.header.context),
  ];

  lines.push(headerTokens.join(" "));

  for (const entry of frame.entries) {
    const tokens = [
      "-",
      `$${entry.id}`,
      ...(entry.agent ? [`@${entry.agent}`] : []),
      ...(entry.respondsTo ? [`&${entry.respondsTo}`] : []),
      ...(entry.dependsOn ?? []).map((dependency) => `+${dependency}`),
      `!${KIND_TO_CODE[entry.kind]}`,
      encodeClaims(entry.claims),
      ...(entry.evidence ?? []).map((item) => `^${item.kind}:${item.ref}`),
      `%${Math.round(entry.confidence * 100)}`,
      `~${INTENT_TO_CODE[entry.intent]}`,
      ...(entry.conflicts ?? []).map((item) => `*${item}`),
      ...encodeContext(entry.context),
    ];

    lines.push(tokens.join(" "));
  }

  lines.push("END");
  return lines.join("\n");
}

export function parseFrame(input: string): OriginFrame {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    throw new Error("Frame requires a header, at least one entry, and END.");
  }

  const headerLine = lines[0];
  const endLine = lines[lines.length - 1];

  if (endLine !== "END") {
    throw new Error("Frame must terminate with END.");
  }

  const headerTokens = headerLine.split(/\s+/);

  if (headerTokens[0] !== "F1") {
    throw new Error(`Unsupported frame version: ${headerTokens[0]}`);
  }

  const header: OriginFrameHeader = {};

  for (const token of headerTokens.slice(1)) {
    if (token.startsWith("@")) {
      header.agent = token.slice(1);
      continue;
    }

    if (token.startsWith("^")) {
      header.evidence = [...(header.evidence ?? []), parseEvidenceToken(token)];
      continue;
    }

    if (token.startsWith("#")) {
      header.context = {
        ...(header.context ?? {}),
        ...parseContextToken(token),
      };
      continue;
    }

    throw new Error(`Invalid frame header token: ${token}`);
  }

  const entries: OriginFrameEntry[] = [];

  for (const rawEntry of lines.slice(1, -1)) {
    if (!rawEntry.startsWith("- ")) {
      throw new Error(`Invalid frame entry line: ${rawEntry}`);
    }

    const entryPacket = parsePacket(materializeEntryPacket(rawEntry.slice(2), header));
    entries.push(toFrameEntry(entryPacket, header));
  }

  return {
    version: "F1",
    header,
    entries,
  };
}

export function groupPacketsIntoFrames(packets: OriginPacket[]): OriginFrame[] {
  if (packets.length === 0) {
    return [];
  }

  const groups: OriginPacket[][] = [];
  let currentGroup: OriginPacket[] = [packets[0]];

  for (const packet of packets.slice(1)) {
    if (canShareFrameHeader(currentGroup[0], packet)) {
      currentGroup.push(packet);
    } else {
      groups.push(currentGroup);
      currentGroup = [packet];
    }
  }

  groups.push(currentGroup);
  return groups.map(buildFrameFromPackets);
}

function canShareFrameHeader(left: OriginPacket, right: OriginPacket): boolean {
  return (
    left.agent === right.agent &&
    sameEvidence(left.evidence, right.evidence) &&
    sameContext(left.context, right.context)
  );
}

function findSharedHeader(packets: OriginPacket[]): OriginFrameHeader {
  const first = packets[0];
  const sharedAgent = packets.every((packet) => packet.agent === first.agent)
    ? first.agent
    : undefined;
  const sharedEvidence = packets.every((packet) => sameEvidence(packet.evidence, first.evidence))
    ? first.evidence
    : [];
  const sharedContext = intersectContext(packets.map((packet) => packet.context));

  return {
    agent: sharedAgent,
    evidence: sharedEvidence.length > 0 ? sharedEvidence : undefined,
    context: Object.keys(sharedContext).length > 0 ? sharedContext : undefined,
  };
}

function toFrameEntry(packet: OriginPacket, header: OriginFrameHeader): OriginFrameEntry {
  return {
    id: packet.id,
    agent: packet.agent === header.agent ? undefined : packet.agent,
    kind: packet.kind,
    claims: packet.claims,
    evidence: subtractEvidence(packet.evidence, header.evidence),
    confidence: packet.confidence,
    intent: packet.intent,
    respondsTo: packet.respondsTo,
    dependsOn: packet.dependsOn,
    conflicts: packet.conflicts,
    context: subtractContext(packet.context, header.context),
  };
}

function encodeClaims(claims: OriginPacket["claims"]): string {
  if (claims.length === 1) {
    const [claim] = claims;
    return `${claim.subject}${claim.relation}${claim.object}`;
  }

  return `[${claims.map((claim) => `${claim.subject}${claim.relation}${claim.object}`).join(",")}]`;
}

function materializeEntryPacket(entryLine: string, header: OriginFrameHeader): string {
  const headerTokens = [
    "O1",
    ...(header.agent ? [`@${header.agent}`] : []),
    ...(header.evidence ?? []).map((item) => `^${item.kind}:${item.ref}`),
    ...encodeContext(header.context),
  ];

  return [...headerTokens, entryLine].join(" ");
}

function parseEvidenceToken(token: string): OriginEvidence {
  const raw = token.slice(1);
  const separator = raw.indexOf(":");

  if (separator <= 0) {
    throw new Error(`Invalid evidence token: ${token}`);
  }

  return {
    kind: raw.slice(0, separator),
    ref: raw.slice(separator + 1),
  };
}

function parseContextToken(token: string): OriginContext {
  const [key, value] = token.slice(1).split("=", 2);

  if (!key || value === undefined) {
    throw new Error(`Invalid context token: ${token}`);
  }

  return { [key]: value };
}

function encodeContext(context?: OriginContext): string[] {
  return Object.entries(context ?? {}).map(([key, value]) => `#${key}=${value}`);
}

function mergeContext(
  left?: OriginContext,
  right?: OriginContext,
): OriginContext | undefined {
  const merged = { ...(left ?? {}), ...(right ?? {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function subtractEvidence(
  evidence: OriginEvidence[],
  shared?: OriginEvidence[],
): OriginEvidence[] | undefined {
  const sharedKeys = new Set((shared ?? []).map((item) => `${item.kind}:${item.ref}`));
  const delta = evidence.filter((item) => !sharedKeys.has(`${item.kind}:${item.ref}`));
  return delta.length > 0 ? delta : undefined;
}

function subtractContext(
  context?: OriginContext,
  shared?: OriginContext,
): OriginContext | undefined {
  const delta = Object.fromEntries(
    Object.entries(context ?? {}).filter(([key, value]) => shared?.[key] !== value),
  );

  return Object.keys(delta).length > 0 ? delta : undefined;
}

function intersectContext(contexts: Array<OriginContext | undefined>): OriginContext {
  const [first, ...rest] = contexts;

  if (!first) {
    return {};
  }

  const sharedEntries = Object.entries(first).filter(([key, value]) =>
    rest.every((context) => context?.[key] === value),
  );

  return Object.fromEntries(sharedEntries);
}

function sameEvidence(left: OriginEvidence[], right: OriginEvidence[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameContext(left?: OriginContext, right?: OriginContext): boolean {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}
