import {
  CODE_TO_INTENT,
  CODE_TO_KIND,
  INTENT_TO_CODE,
  KIND_TO_CODE,
} from "./vocabulary.js";
import type {
  OriginClaim,
  OriginEvidence,
  OriginPacket,
  OriginRelation,
} from "./model.js";

const CLAIM_OPERATORS: OriginRelation[] = ["!=", ">=", "<=", "->", "=", ">", "<"];
const COMPACT_TOKEN_PATTERN = /^[A-Za-z0-9._:@/-]+$/;

export function encodePacket(packet: OriginPacket): string {
  const normalized = canonicalizePacket(packet);
  validatePacket(normalized);

  const tokens: string[] = [
    normalized.version,
    `$${normalized.id}`,
    `@${normalized.agent}`,
  ];

  if (normalized.respondsTo) {
    tokens.push(`&${normalized.respondsTo}`);
  }

  for (const dependency of normalized.dependsOn ?? []) {
    tokens.push(`+${dependency}`);
  }

  tokens.push(`!${KIND_TO_CODE[normalized.kind]}`);

  if (normalized.claims.length === 1) {
    tokens.push(encodeClaim(normalized.claims[0]));
  } else {
    tokens.push(`[${normalized.claims.map(encodeClaim).join(",")}]`);
  }

  for (const item of normalized.evidence) {
    tokens.push(`^${item.kind}:${item.ref}`);
  }

  tokens.push(`%${Math.round(normalized.confidence * 100)}`);
  tokens.push(`~${INTENT_TO_CODE[normalized.intent]}`);

  for (const conflict of normalized.conflicts ?? []) {
    tokens.push(`*${conflict}`);
  }

  for (const [key, value] of Object.entries(normalized.context ?? {})) {
    tokens.push(`#${key}=${value}`);
  }

  return tokens.join(" ");
}

export function parsePacket(input: string): OriginPacket {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Origin packet cannot be empty.");
  }

  const tokens = tokenize(trimmed);
  const [version, ...rest] = tokens;

  if (version !== "O1") {
    throw new Error(`Unsupported Origin version: ${version}`);
  }

  let agent = "";
  let id = "";
  let kind = "";
  let confidence = 1;
  let intent = "";
  let respondsTo = "";
  const claims: OriginClaim[] = [];
  const evidence: OriginEvidence[] = [];
  const dependsOn: string[] = [];
  const conflicts: string[] = [];
  const context: Record<string, string> = {};

  for (const token of rest) {
    if (token.startsWith("$")) {
      id = token.slice(1);
      continue;
    }

    if (token.startsWith("@")) {
      agent = token.slice(1);
      continue;
    }

    if (token.startsWith("&")) {
      respondsTo = token.slice(1);
      continue;
    }

    if (token.startsWith("+")) {
      dependsOn.push(token.slice(1));
      continue;
    }

    if (token.startsWith("!")) {
      kind = decodeCode(token.slice(1), CODE_TO_KIND, "kind");
      continue;
    }

    if (token.startsWith("^")) {
      evidence.push(parseEvidence(token.slice(1)));
      continue;
    }

    if (token.startsWith("%")) {
      confidence = parseConfidence(token.slice(1));
      continue;
    }

    if (token.startsWith("~")) {
      intent = decodeCode(token.slice(1), CODE_TO_INTENT, "intent");
      continue;
    }

    if (token.startsWith("*")) {
      conflicts.push(token.slice(1));
      continue;
    }

    if (token.startsWith("#")) {
      const [key, value] = token.slice(1).split("=", 2);
      if (!key || value === undefined) {
        throw new Error(`Invalid context token: ${token}`);
      }
      context[key] = value;
      continue;
    }

    if (token.startsWith("[") && token.endsWith("]")) {
      const bundle = token.slice(1, -1);
      for (const rawClaim of bundle.split(",")) {
        claims.push(parseClaim(rawClaim));
      }
      continue;
    }

    claims.push(parseClaim(token));
  }

  const packet: OriginPacket = {
    version: "O1",
    id,
    agent,
    kind: kind as OriginPacket["kind"],
    claims,
    evidence,
    confidence,
    intent: intent as OriginPacket["intent"],
    respondsTo: respondsTo || undefined,
    dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    context: Object.keys(context).length > 0 ? context : undefined,
  };

  const normalized = canonicalizePacket(packet);
  validatePacket(normalized);
  return normalized;
}

export function validatePacket(packet: OriginPacket): void {
  if (packet.version !== "O1") {
    throw new Error("Only Origin version O1 is supported.");
  }

  if (!packet.id) {
    throw new Error("Origin packet requires an id.");
  }

  if (!packet.agent) {
    throw new Error("Origin packet requires an agent.");
  }

  if (!(packet.kind in KIND_TO_CODE)) {
    throw new Error(`Unknown packet kind: ${packet.kind}`);
  }

  if (packet.claims.length === 0) {
    throw new Error("Origin packet requires at least one claim.");
  }

  if (packet.evidence.length === 0) {
    throw new Error("Origin packet requires at least one evidence reference.");
  }

  if (packet.confidence < 0 || packet.confidence > 1) {
    throw new Error("Confidence must be between 0 and 1.");
  }

  if (!(packet.intent in INTENT_TO_CODE)) {
    throw new Error(`Unknown packet intent: ${packet.intent}`);
  }

  validateCompactToken(packet.id, "Packet id");
  validateCompactToken(packet.agent, "Agent");

  if (packet.respondsTo) {
    validateCompactToken(packet.respondsTo, "Response reference");

    if (packet.respondsTo === packet.id) {
      throw new Error("Packet cannot respond to itself.");
    }
  }

  if (packet.kind === "revise" || packet.kind === "reject") {
    if (!packet.respondsTo) {
      throw new Error(`${packet.kind} packets require a response reference.`);
    }
  }

  const dependencySet = new Set<string>();

  for (const dependency of packet.dependsOn ?? []) {
    validateCompactToken(dependency, "Dependency reference");

    if (dependency === packet.id) {
      throw new Error("Packet cannot depend on itself.");
    }

    if (dependencySet.has(dependency)) {
      throw new Error(`Duplicate dependency reference: ${dependency}`);
    }

    dependencySet.add(dependency);
  }

  for (const claim of packet.claims) {
    if (!claim.subject || !claim.object) {
      throw new Error("Claims require both subject and object.");
    }

    if (!CLAIM_OPERATORS.includes(claim.relation)) {
      throw new Error(`Unsupported relation: ${claim.relation}`);
    }

    validateCompactToken(claim.subject, "Claim subject");
    validateCompactToken(claim.object, "Claim object");
  }

  for (const item of packet.evidence) {
    if (!item.kind || !item.ref) {
      throw new Error("Evidence requires a kind and ref.");
    }

    validateCompactToken(item.kind, "Evidence kind");
    validateCompactToken(item.ref, "Evidence ref");
  }

  const conflictSet = new Set<string>();

  for (const conflict of packet.conflicts ?? []) {
    validateCompactToken(conflict, "Conflict reference");

    if (conflictSet.has(conflict)) {
      throw new Error(`Duplicate conflict reference: ${conflict}`);
    }

    conflictSet.add(conflict);
  }

  for (const [key, value] of Object.entries(packet.context ?? {})) {
    validateCompactToken(key, "Context key");
    validateCompactToken(value, "Context value");
  }
}

export function estimateUtf8Bytes(input: string): number {
  return Buffer.byteLength(input, "utf8");
}

export function canonicalizePacket(packet: OriginPacket): OriginPacket {
  return {
    ...packet,
    dependsOn: dedupeAndSort(packet.dependsOn),
    evidence: sortEvidence(packet.evidence),
    conflicts: dedupeAndSort(packet.conflicts),
    context: sortContext(packet.context),
  };
}

function encodeClaim(claim: OriginClaim): string {
  return `${claim.subject}${claim.relation}${claim.object}`;
}

function parseClaim(token: string): OriginClaim {
  for (const operator of CLAIM_OPERATORS) {
    const index = token.indexOf(operator);
    if (index > 0) {
      return {
        subject: token.slice(0, index),
        relation: operator,
        object: token.slice(index + operator.length),
      };
    }
  }

  throw new Error(`Invalid claim token: ${token}`);
}

function parseEvidence(token: string): OriginEvidence {
  const separator = token.indexOf(":");

  if (separator <= 0) {
    throw new Error(`Invalid evidence token: ^${token}`);
  }

  return {
    kind: token.slice(0, separator),
    ref: token.slice(separator + 1),
  };
}

function parseConfidence(token: string): number {
  const numeric = Number(token);

  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid confidence token: %${token}`);
  }

  return numeric > 1 ? numeric / 100 : numeric;
}

function validateCompactToken(value: string, label: string): void {
  if (!COMPACT_TOKEN_PATTERN.test(value)) {
    throw new Error(`${label} contains unsupported characters: ${value}`);
  }
}

function decodeCode<TValue extends string>(
  raw: string,
  map: Record<string, TValue>,
  label: string,
): TValue {
  const value = map[raw];

  if (!value) {
    throw new Error(`Unknown ${label} code: ${raw}`);
  }

  return value;
}

function dedupeAndSort(values?: string[]): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sortEvidence(evidence: OriginEvidence[]): OriginEvidence[] {
  return [...evidence].sort((left, right) => {
    const leftKey = `${left.kind}:${left.ref}`;
    const rightKey = `${right.kind}:${right.ref}`;
    return leftKey.localeCompare(rightKey);
  });
}

function sortContext(
  context?: Record<string, string>,
): Record<string, string> | undefined {
  if (!context || Object.keys(context).length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context).sort(([left], [right]) => left.localeCompare(right)),
  );
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
