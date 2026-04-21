import { createHash } from "node:crypto";

import { canonicalizePacket, validatePacket } from "./codec.js";
import type { OriginClaim, OriginContext, OriginEvidence, OriginIntent, OriginKind, OriginPacket } from "./model.js";

const HEADER_PATTERN =
  /^(?:packet\s+(?<id>[A-Za-z0-9._:@/-]+)\s+from\s+)?agent\s+(?<agent>[A-Za-z0-9._:@/-]+)\s+(?<kind>asserts|queries|proposes|commits|revises|rejects)\s+that\s+(?<rest>.+)$/i;

const CLAIM_PATTERNS: Array<{ phrase: string; relation: OriginClaim["relation"] }> = [
  { phrase: " is not ", relation: "!=" },
  { phrase: " is at least ", relation: ">=" },
  { phrase: " is at most ", relation: "<=" },
  { phrase: " is above ", relation: ">" },
  { phrase: " is below ", relation: "<" },
  { phrase: " routes to ", relation: "->" },
  { phrase: " is ", relation: "=" },
];

const EVIDENCE_KIND_MAP: Record<string, string> = {
  cam: "cam",
  camera: "cam",
  cameras: "cam",
  human: "human",
  lidar: "lidar",
  log: "log",
  logs: "log",
  memory: "memory",
  mic: "mic",
  microphone: "mic",
  sensor: "sensor",
  sensors: "sensor",
  text: "text",
  texts: "text",
  voice: "voice",
};

const KIND_VERB_MAP: Record<string, OriginKind> = {
  asserts: "assert",
  queries: "query",
  proposes: "propose",
  commits: "commit",
  revises: "revise",
  rejects: "reject",
};

const INTENT_TEXT_MAP: Record<string, OriginIntent> = {
  act: "act",
  assist: "assist",
  escalate: "escalate",
  hold: "hold",
  merge: "merge",
  notify: "notify",
  observe: "observe",
  verify: "verify",
};

const DEFAULT_INTENT_BY_KIND: Record<OriginKind, OriginIntent> = {
  assert: "observe",
  query: "verify",
  propose: "act",
  commit: "act",
  revise: "merge",
  reject: "hold",
};

export interface CompileWarning {
  code: string;
  message: string;
}

export interface CompileResult {
  packet: OriginPacket;
  assumptions: CompileWarning[];
  normalizedInput: string;
}

export interface CompileOptions {
  defaultContext?: OriginContext;
  defaultEvidence?: OriginEvidence[];
  defaultConfidence?: number;
  defaultIntentByKind?: Partial<Record<OriginKind, OriginIntent>>;
  idPrefix?: string;
}

export function compileEnglishPacket(
  input: string,
  options: CompileOptions = {},
): CompileResult {
  const normalizedInput = normalizeInput(input);
  const assumptions: CompileWarning[] = [];
  const headerMatch = HEADER_PATTERN.exec(normalizedInput);

  if (!headerMatch?.groups) {
    throw new Error(
      "English packet must start with 'Agent <agent> <kind> that ...' or 'Packet <id> from agent <agent> <kind> that ...'.",
    );
  }

  const agent = compactToken(headerMatch.groups.agent, { lowerCase: true });
  const kind = KIND_VERB_MAP[headerMatch.groups.kind.toLowerCase()];
  const claims = parseClaims(extractClaimText(headerMatch.groups.rest));
  const id =
    headerMatch.groups.id ??
    generatePacketId(agent, kind, claims, normalizedInput, options.idPrefix ?? "auto");

  if (!headerMatch.groups.id) {
    assumptions.push({
      code: "generated-id",
      message: `Generated packet id '${id}' because the source text did not include one.`,
    });
  }

  const evidence = parseEvidence(normalizedInput);

  if (evidence.length === 0) {
    const fallbackEvidence =
      options.defaultEvidence ?? [{ kind: "human", ref: `prompt-${shortHash(normalizedInput)}` }];

    evidence.push(...fallbackEvidence);
    assumptions.push({
      code: "default-evidence",
      message: "Inserted default evidence because the source text did not include a 'based on' clause.",
    });
  }

  const confidence = parseConfidence(normalizedInput);
  const finalConfidence = confidence ?? options.defaultConfidence ?? 0.5;

  if (confidence === undefined) {
    assumptions.push({
      code: "default-confidence",
      message: `Applied default confidence ${Math.round(finalConfidence * 100)}%.`,
    });
  }

  const explicitIntent = parseIntent(normalizedInput);
  const inferredIntent =
    explicitIntent ??
    options.defaultIntentByKind?.[kind] ??
    DEFAULT_INTENT_BY_KIND[kind];

  if (!explicitIntent) {
    assumptions.push({
      code: "default-intent",
      message: `Inferred intent '${inferredIntent}' from packet kind '${kind}'.`,
    });
  }

  const packet: OriginPacket = canonicalizePacket({
    version: "O1",
    id,
    agent,
    kind,
    claims,
    evidence,
    confidence: finalConfidence,
    intent: inferredIntent,
    respondsTo: parseSingleReference(normalizedInput, /responds to\s+([A-Za-z0-9._:@/-]+)/i),
    dependsOn: parseReferenceList(normalizedInput, /\bdepends on\s+(.+?)(?=(?:\.\s*|\bcontext\b|\bconflicts\b|$))/i),
    conflicts: parseReferenceList(normalizedInput, /\bconflicts\s+(.+?)(?=(?:\.\s*|$))/i),
    context: mergeContext(options.defaultContext, parseContext(normalizedInput)),
  });

  validatePacket(packet);

  return {
    packet,
    assumptions,
    normalizedInput,
  };
}

function normalizeInput(input: string): string {
  return input
    .replace(/\r?\n+/g, " ")
    .replace(/;/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractClaimText(rest: string): string {
  const markers = [
    /\bbased on\b/i,
    /\bwith\s+\d+(?:\.\d+)?% confidence\b/i,
    /\b(?:observe|verify|act|assist|hold|merge|notify|escalate)\s+next\b/i,
    /\bresponds to\b/i,
    /\bdepends on\b/i,
    /\bcontext\b/i,
    /\bconflicts\b/i,
  ];

  let endIndex = rest.length;

  for (const marker of markers) {
    const match = marker.exec(rest);

    if (match && match.index < endIndex) {
      endIndex = match.index;
    }
  }

  const claimText = rest.slice(0, endIndex).replace(/[.,\s]+$/g, "").trim();

  if (!claimText) {
    throw new Error("Could not find a claim clause after the packet header.");
  }

  return claimText;
}

function parseClaims(input: string): OriginClaim[] {
  return splitList(input).map((rawClaim) => parseClaim(rawClaim));
}

function parseClaim(input: string): OriginClaim {
  for (const pattern of CLAIM_PATTERNS) {
    const index = input.toLowerCase().indexOf(pattern.phrase);

    if (index < 0) {
      continue;
    }

    const subject = input.slice(0, index);
    const object = input.slice(index + pattern.phrase.length);

    return {
      subject: compactToken(subject, { lowerCase: true }),
      relation: pattern.relation,
      object: compactToken(object),
    };
  }

  throw new Error(`Unsupported claim phrase: ${input}`);
}

function parseEvidence(input: string): OriginEvidence[] {
  const match = /\bbased on\s+(.+?)(?=(?:\.\s*|\bwith\s+\d+(?:\.\d+)?% confidence\b|\b(?:observe|verify|act|assist|hold|merge|notify|escalate)\s+next\b|\bresponds to\b|\bdepends on\b|\bcontext\b|\bconflicts\b|$))/i.exec(
    input,
  );

  if (!match) {
    return [];
  }

  return splitList(match[1]).map((item) => parseEvidenceItem(item));
}

function parseEvidenceItem(input: string): OriginEvidence {
  const trimmed = stripOuterPunctuation(input);

  const colonSyntaxMatch = /^([A-Za-z0-9._/-]+):(.*)$/.exec(trimmed);

  if (colonSyntaxMatch && !/\s/.test(colonSyntaxMatch[1])) {
    const [, kind, ref] = colonSyntaxMatch;
    return {
      kind: normalizeEvidenceKind(kind),
      ref: compactToken(ref),
    };
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length < 2) {
    throw new Error(`Invalid evidence item: ${input}`);
  }

  const [rawKind, ...rest] = parts;

  return {
    kind: normalizeEvidenceKind(rawKind),
    ref: compactToken(rest.join(" ")),
  };
}

function parseConfidence(input: string): number | undefined {
  const match = /\bwith\s+(\d{1,3}(?:\.\d+)?)% confidence\b/i.exec(input);

  if (!match) {
    return undefined;
  }

  return Number(match[1]) / 100;
}

function parseIntent(input: string): OriginIntent | undefined {
  const match = /\b(observe|verify|act|assist|hold|merge|notify|escalate)\s+next\b/i.exec(input);

  if (!match) {
    return undefined;
  }

  return INTENT_TEXT_MAP[match[1].toLowerCase()];
}

function parseContext(input: string): OriginContext | undefined {
  const match = /\bcontext\s+(.+?)(?=(?:\.\s*|\bconflicts\b|$))/i.exec(input);

  if (!match) {
    return undefined;
  }

  const entries = splitList(match[1]).map((item) => parseContextEntry(item));
  return Object.fromEntries(entries);
}

function parseContextEntry(input: string): [string, string] {
  const parts = stripOuterPunctuation(input).split(/\s+/);

  if (parts.length < 2) {
    throw new Error(`Invalid context entry: ${input}`);
  }

  const [rawKey, ...rawValue] = parts;

  return [
    compactToken(rawKey, { lowerCase: true }),
    compactToken(rawValue.join(" ")),
  ];
}

function parseSingleReference(input: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(input);
  return match ? compactToken(match[1]) : undefined;
}

function parseReferenceList(input: string, pattern: RegExp): string[] | undefined {
  const match = pattern.exec(input);

  if (!match) {
    return undefined;
  }

  const values = splitList(match[1]).map((item) => compactToken(item));
  return values.length > 0 ? values : undefined;
}

function splitList(input: string): string[] {
  return input
    .split(/\s*,\s*|\s+and\s+/i)
    .map((item) => stripOuterPunctuation(item))
    .filter(Boolean);
}

function normalizeEvidenceKind(input: string): string {
  const normalized = compactToken(input, { lowerCase: true });
  return EVIDENCE_KIND_MAP[normalized] ?? normalized;
}

function compactToken(input: string, options?: { lowerCase?: boolean }): string {
  let value = stripOuterPunctuation(input).replace(/\s+/g, "-");

  if (options?.lowerCase) {
    value = value.toLowerCase();
  }

  value = value.replace(/[^A-Za-z0-9._:@/-]+/g, "-").replace(/-+/g, "-");
  value = value.replace(/^-+|-+$/g, "");

  if (!value) {
    throw new Error(`Could not normalize token from '${input}'.`);
  }

  return value;
}

function stripOuterPunctuation(input: string): string {
  return input.trim().replace(/^[\s"'`({[\]]+|[\s"'`)}\].,]+$/g, "");
}

function generatePacketId(
  agent: string,
  kind: OriginKind,
  claims: OriginClaim[],
  source: string,
  prefix: string,
): string {
  const firstClaim = claims[0];
  const basis = `${agent}-${kind}-${firstClaim.subject}-${shortHash(source)}`;
  return `${compactToken(prefix, { lowerCase: true })}-${compactToken(basis, { lowerCase: true })}`;
}

function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 8);
}

function mergeContext(
  left?: OriginContext,
  right?: OriginContext,
): OriginContext | undefined {
  const merged = { ...(left ?? {}), ...(right ?? {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}
