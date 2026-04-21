import { canonicalizePacket, estimateUtf8Bytes, validatePacket } from "./codec.js";
import type { OriginContext, OriginPacket } from "./model.js";
import { CODE_TO_INTENT, CODE_TO_KIND, INTENT_TO_CODE, KIND_TO_CODE } from "./vocabulary.js";

export type OriginWireAtom = number | string;

export type OriginWireClaim = [OriginWireAtom, OriginPacket["claims"][number]["relation"], OriginWireAtom];
export type OriginWireEvidence = [OriginWireAtom, OriginWireAtom];
export type OriginWireContextEntry = [OriginWireAtom, OriginWireAtom];

export type OriginWirePacket = [
  id: string,
  agent: OriginWireAtom,
  kindCode: string,
  claims: OriginWireClaim[],
  evidence: OriginWireEvidence[],
  confidencePercent: number,
  intentCode: string,
  respondsTo: string | null,
  dependsOn: string[] | null,
  conflicts: string[] | null,
  context: OriginWireContextEntry[] | null,
];

export interface OriginWireBundle {
  version: "W1";
  lexicon: string[];
  packets: OriginWirePacket[];
}

export interface OriginWireLexiconOptions {
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

export function deriveWireLexicon(
  packets: OriginPacket[],
  options: OriginWireLexiconOptions = {},
): string[] {
  const minFrequency = options.minFrequency ?? 2;
  const counts = new Map<string, number>();

  for (const packet of packets.map(canonicalizePacket)) {
    bump(counts, packet.agent);

    for (const claim of packet.claims) {
      bump(counts, claim.subject);
      bump(counts, claim.object);
    }

    for (const evidence of packet.evidence) {
      bump(counts, evidence.kind);
      bump(counts, evidence.ref);
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

export function encodeWireBundle(
  packets: OriginPacket[],
  options: OriginWireLexiconOptions = {},
): OriginWireBundle {
  const normalizedPackets = packets.map(canonicalizePacket);
  const lexicon = deriveWireLexicon(normalizedPackets, options);
  const lexiconIndex = new Map(lexicon.map((token, index) => [token, index]));

  return {
    version: "W1",
    lexicon,
    packets: normalizedPackets.map((packet) => encodeWirePacket(packet, lexiconIndex)),
  };
}

export function decodeWireBundle(bundle: OriginWireBundle): OriginPacket[] {
  if (bundle.version !== "W1") {
    throw new Error(`Unsupported wire bundle version: ${bundle.version}`);
  }

  return bundle.packets.map((packet) => decodeWirePacket(packet, bundle.lexicon));
}

export function parseWireString(input: string): OriginWireBundle {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 1) {
    throw new Error("Wire string cannot be empty.");
  }

  const [header, ...packetLines] = lines;
  const [version, rawLexicon = "-"] = header.split("|", 2);

  if (version !== "W1") {
    throw new Error(`Unsupported wire string version: ${version}`);
  }

  const lexicon = rawLexicon === "-" || rawLexicon === "" ? [] : rawLexicon.split(",");
  const packets = packetLines.map((line) => parseWirePacketLine(line));

  return {
    version: "W1",
    lexicon,
    packets,
  };
}

export function encodeWirePacket(
  packet: OriginPacket,
  lexiconIndex: Map<string, number>,
): OriginWirePacket {
  const normalized = canonicalizePacket(packet);
  validatePacket(normalized);

  return [
    normalized.id,
    encodeWireAtom(normalized.agent, lexiconIndex),
    KIND_TO_CODE[normalized.kind],
    normalized.claims.map((claim) => [
      encodeWireAtom(claim.subject, lexiconIndex),
      claim.relation,
      encodeWireAtom(claim.object, lexiconIndex),
    ]),
    normalized.evidence.map((item) => [
      encodeWireAtom(item.kind, lexiconIndex),
      encodeWireAtom(item.ref, lexiconIndex),
    ]),
    Math.round(normalized.confidence * 100),
    INTENT_TO_CODE[normalized.intent],
    normalized.respondsTo ?? null,
    normalized.dependsOn ?? null,
    normalized.conflicts ?? null,
    encodeWireContext(normalized.context, lexiconIndex),
  ];
}

export function decodeWirePacket(
  packet: OriginWirePacket,
  lexicon: string[],
): OriginPacket {
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
  ] = packet;

  const decoded: OriginPacket = canonicalizePacket({
    version: "O1",
    id,
    agent: decodeWireAtom(agent, lexicon),
    kind: decodeCode(kindCode, CODE_TO_KIND as Record<string, OriginPacket["kind"]>, "kind"),
    claims: claims.map(([subject, relation, object]) => ({
      subject: decodeWireAtom(subject, lexicon),
      relation,
      object: decodeWireAtom(object, lexicon),
    })),
    evidence: evidence.map(([kind, ref]) => ({
      kind: decodeWireAtom(kind, lexicon),
      ref: decodeWireAtom(ref, lexicon),
    })),
    confidence: confidencePercent / 100,
    intent: decodeCode(
      intentCode,
      CODE_TO_INTENT as Record<string, OriginPacket["intent"]>,
      "intent",
    ),
    respondsTo: respondsTo ?? undefined,
    dependsOn: dependsOn ?? undefined,
    conflicts: conflicts ?? undefined,
    context: decodeWireContext(context, lexicon),
  });

  validatePacket(decoded);
  return decoded;
}

export function encodeWireString(bundle: OriginWireBundle): string {
  const header = `W1|${bundle.lexicon.length > 0 ? bundle.lexicon.join(",") : "-"}`;
  const packetLines = bundle.packets.map((packet) => encodeWirePacketLine(packet));
  return [header, ...packetLines].join("\n");
}

export function estimateWireBytes(bundle: OriginWireBundle): number {
  return estimateUtf8Bytes(encodeWireString(bundle));
}

function encodeWireContext(
  context: OriginContext | undefined,
  lexiconIndex: Map<string, number>,
): OriginWireContextEntry[] | null {
  if (!context || Object.keys(context).length === 0) {
    return null;
  }

  return Object.entries(context).map(([key, value]) => [
    encodeWireAtom(key, lexiconIndex),
    encodeWireAtom(value, lexiconIndex),
  ]);
}

function encodeWirePacketLine(packet: OriginWirePacket): string {
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
  ] = packet;

  return [
    id,
    serializeAtom(agent),
    kindCode,
    claims.map(([subject, relation, object]) => `${serializeAtom(subject)}${relation}${serializeAtom(object)}`).join(","),
    evidence.map(([kind, ref]) => `${serializeAtom(kind)}!${serializeAtom(ref)}`).join(","),
    String(confidencePercent),
    intentCode,
    respondsTo ?? "-",
    serializeStringList(dependsOn),
    serializeStringList(conflicts),
    serializeContextEntries(context),
  ].join("|");
}

function parseWirePacketLine(line: string): OriginWirePacket {
  const fields = line.split("|");

  if (fields.length !== 11) {
    throw new Error(`Invalid wire packet line: ${line}`);
  }

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
  ] = fields;

  return [
    id,
    parseAtom(agent),
    kindCode,
    claims === "" ? [] : claims.split(",").map(parseWireClaim),
    evidence === "" ? [] : evidence.split(",").map(parseWireEvidence),
    Number(confidencePercent),
    intentCode,
    respondsTo === "-" ? null : respondsTo,
    parseStringList(dependsOn),
    parseStringList(conflicts),
    parseContextEntries(context),
  ];
}

function decodeWireContext(
  context: OriginWireContextEntry[] | null,
  lexicon: string[],
): OriginContext | undefined {
  if (!context || context.length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    context.map(([key, value]) => [decodeWireAtom(key, lexicon), decodeWireAtom(value, lexicon)]),
  );
}

function serializeAtom(value: OriginWireAtom): string {
  return typeof value === "number" ? `~${value}` : value;
}

function parseAtom(value: string): OriginWireAtom {
  if (/^~\d+$/.test(value)) {
    return Number(value.slice(1));
  }

  return value;
}

function parseWireClaim(claim: string): OriginWireClaim {
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

  throw new Error(`Invalid wire claim: ${claim}`);
}

function parseWireEvidence(evidence: string): OriginWireEvidence {
  const separator = evidence.indexOf("!");

  if (separator <= 0) {
    throw new Error(`Invalid wire evidence: ${evidence}`);
  }

  return [
    parseAtom(evidence.slice(0, separator)),
    parseAtom(evidence.slice(separator + 1)),
  ];
}

function serializeStringList(values: string[] | null): string {
  return values && values.length > 0 ? values.join(",") : "-";
}

function parseStringList(value: string): string[] | null {
  return value === "-" ? null : value.split(",").filter(Boolean);
}

function serializeContextEntries(context: OriginWireContextEntry[] | null): string {
  if (!context || context.length === 0) {
    return "-";
  }

  return context.map(([key, value]) => `${serializeAtom(key)}=${serializeAtom(value)}`).join(",");
}

function parseContextEntries(value: string): OriginWireContextEntry[] | null {
  if (value === "-") {
    return null;
  }

  return value.split(",").map((entry) => {
    const separator = entry.indexOf("=");

    if (separator <= 0) {
      throw new Error(`Invalid wire context entry: ${entry}`);
    }

    return [
      parseAtom(entry.slice(0, separator)),
      parseAtom(entry.slice(separator + 1)),
    ];
  });
}

function encodeWireAtom(value: string, lexiconIndex: Map<string, number>): OriginWireAtom {
  return lexiconIndex.get(value) ?? value;
}

function decodeWireAtom(value: OriginWireAtom, lexicon: string[]): string {
  if (typeof value === "number") {
    const resolved = lexicon[value];

    if (resolved === undefined) {
      throw new Error(`Invalid wire lexicon index: ${value}`);
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
