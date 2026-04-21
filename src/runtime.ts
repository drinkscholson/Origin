import { canonicalizePacket, estimateUtf8Bytes, validatePacket } from "./codec.js";
import { compileEnglishPacket } from "./compiler.js";
import { decodeFrameWireBundle, encodeFrameWireBundle, encodeFrameWireString, estimateFrameWireBytes, parseFrameWireString } from "./fw.js";
import { buildLedger, type OriginLedger } from "./ledger.js";
import type { OriginContext, OriginPacket } from "./model.js";
import { renderEnglish } from "./render.js";

export interface OriginRuntimeDispatch {
  to: string;
  packet: OriginPacket;
}

export interface OriginRuntimeEnvelope {
  round: number;
  from: string;
  to: string;
  packets: OriginPacket[];
  encoded: string;
  lexiconSize: number;
  englishBytes: number;
  frameWireBytes: number;
}

export interface OriginRuntimeAgentContext {
  agentId: string;
  round: number;
  inbound: OriginPacket[];
  memory: OriginPacket[];
  knownPackets: Map<string, OriginPacket>;
  ledger: OriginLedger;
}

export interface OriginRuntimeAgent {
  id: string;
  role: string;
  handle(context: OriginRuntimeAgentContext): OriginRuntimeDispatch[];
}

export interface OriginRuntimeResult {
  ingressEnglish: string;
  ingressPacket: OriginPacket;
  transports: OriginRuntimeEnvelope[];
  finalPackets: OriginPacket[];
  memory: OriginPacket[];
  ledger: OriginLedger;
  totalEnglishBytes: number;
  totalFrameWireBytes: number;
  transportMode: "FW1";
}

export interface OriginRuntimeOptions {
  maxRounds?: number;
}

type OriginPacketDraft = Omit<OriginPacket, "version"> & { version?: "O1" };

export const DEFAULT_RUNTIME_INPUT =
  "Packet rt-hx77-alert from agent human asserts that user is distress and heat is above 47 based on voice 55 and cam 17@09:20 with 92% confidence. Escalate next. Context incident HX77, room B, priority high, facility ALPHA.";

const DEFAULT_AGENTS: OriginRuntimeAgent[] = [
  {
    id: "coordinator",
    role: "Plans the next coordination steps and notifies the gateway when the response is live.",
    handle: handleCoordinator,
  },
  {
    id: "safety",
    role: "Verifies the corridor and commits environmental controls.",
    handle: handleSafety,
  },
  {
    id: "dispatch",
    role: "Commits the responder route once the corridor is verified.",
    handle: handleDispatch,
  },
];

export function runDefaultRuntimeSession(
  ingressEnglish: string = DEFAULT_RUNTIME_INPUT,
  options: OriginRuntimeOptions = {},
): OriginRuntimeResult {
  return runOriginRuntimeSession(ingressEnglish, DEFAULT_AGENTS, options);
}

export function runOriginRuntimeSession(
  ingressEnglish: string,
  agents: OriginRuntimeAgent[],
  options: OriginRuntimeOptions = {},
): OriginRuntimeResult {
  const ingressPacket = compileEnglishPacket(ingressEnglish).packet;
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
  const knownPackets = new Map<string, OriginPacket>();
  const deliveredPackets: OriginPacket[] = [];
  const transports: OriginRuntimeEnvelope[] = [];
  const finalPackets: OriginPacket[] = [];
  const queue: OriginRuntimeEnvelope[] = [];
  const maxRounds = options.maxRounds ?? 8;

  scheduleEnvelope({
    round: 1,
    from: "gateway",
    to: "coordinator",
    packets: [ingressPacket],
    queue,
    knownPackets,
  });

  while (queue.length > 0) {
    const envelope = queue.shift();

    if (!envelope) {
      break;
    }

    if (envelope.round > maxRounds) {
      throw new Error(`Runtime exceeded max rounds (${maxRounds}).`);
    }

    const decodedPackets = decodeFrameWireBundle(parseFrameWireString(envelope.encoded));

    for (const packet of decodedPackets) {
      if (!deliveredPackets.some((candidate) => candidate.id === packet.id)) {
        deliveredPackets.push(packet);
      }
    }

    transports.push({
      ...envelope,
      packets: decodedPackets,
    });

    const agent = agentMap.get(envelope.to);

    if (!agent) {
      finalPackets.push(...decodedPackets);
      continue;
    }

    const memory = deliveredPackets.map((packet) => canonicalizePacket(packet));
    const ledger = buildLedger(memory);
    const dispatches = agent.handle({
      agentId: agent.id,
      round: envelope.round,
      inbound: decodedPackets,
      memory,
      knownPackets,
      ledger,
    });

    const grouped = groupDispatches(dispatches);

    for (const [target, packets] of grouped) {
      scheduleEnvelope({
        round: envelope.round + 1,
        from: agent.id,
        to: target,
        packets,
        queue,
        knownPackets,
      });
    }
  }

  const memory = deliveredPackets.map((packet) => canonicalizePacket(packet));
  const ledger = buildLedger(memory);
  const totalEnglishBytes = transports.reduce((total, transport) => total + transport.englishBytes, 0);
  const totalFrameWireBytes = transports.reduce(
    (total, transport) => total + transport.frameWireBytes,
    0,
  );

  return {
    ingressEnglish,
    ingressPacket,
    transports,
    finalPackets,
    memory,
    ledger,
    totalEnglishBytes,
    totalFrameWireBytes,
    transportMode: "FW1",
  };
}

function handleCoordinator(context: OriginRuntimeAgentContext): OriginRuntimeDispatch[] {
  const outputs: OriginRuntimeDispatch[] = [];

  for (const packet of context.inbound) {
    const room = packet.context?.room ?? "unknown";
    const roomTarget = `room${room}`;
    const packetRoot = packet.id;

    if (packet.agent === "human") {
      const corridorQueryId = `${packetRoot}-q-corridor`;
      const medicProposalId = `${packetRoot}-p-medic`;
      const ventProposalId = `${packetRoot}-p-vent`;

      if (!context.knownPackets.has(corridorQueryId)) {
        outputs.push({
          to: "safety",
          packet: buildPacket({
            id: corridorQueryId,
            agent: "coordinator",
            kind: "query",
            claims: [{ subject: "corridor", relation: "=", object: "clear" }],
            evidence: [{ kind: "relay", ref: packet.id }],
            confidence: 0.82,
            intent: "verify",
            respondsTo: packet.id,
            context: packet.context,
          }),
        });
      }

      if (!context.knownPackets.has(ventProposalId)) {
        outputs.push({
          to: "safety",
          packet: buildPacket({
            id: ventProposalId,
            agent: "coordinator",
            kind: "propose",
            claims: [{ subject: "vent", relation: "=", object: "on" }],
            evidence: [{ kind: "relay", ref: packet.id }],
            confidence: 0.84,
            intent: "act",
            respondsTo: packet.id,
            context: packet.context,
          }),
        });
      }

      if (
        hasClaim(packet, "user", "=", "distress") &&
        !context.knownPackets.has(medicProposalId)
      ) {
        outputs.push({
          to: "dispatch",
          packet: buildPacket({
            id: medicProposalId,
            agent: "coordinator",
            kind: "propose",
            claims: [{ subject: "medic", relation: "->", object: roomTarget }],
            evidence: [{ kind: "relay", ref: packet.id }],
            confidence: 0.86,
            intent: "assist",
            respondsTo: packet.id,
            dependsOn: [corridorQueryId],
            context: packet.context,
          }),
        });
      }
    }
  }

  const ingressPacket = findPacket(context.memory, (packet) => packet.agent === "human");

  if (ingressPacket) {
    const summaryId = `${ingressPacket.id}-n-summary`;
    const medicCommitId = `${ingressPacket.id}-c-medic`;
    const ventCommitId = `${ingressPacket.id}-c-vent`;
    const medicCommit = context.knownPackets.get(medicCommitId);
    const ventCommit = context.knownPackets.get(ventCommitId);

    if (medicCommit && ventCommit && !context.knownPackets.has(summaryId)) {
      outputs.push({
        to: "gateway",
        packet: buildPacket({
          id: summaryId,
          agent: "coordinator",
          kind: "assert",
          claims: [{ subject: "response", relation: "=", object: "active" }],
          evidence: [
            { kind: "relay", ref: medicCommit.id },
            { kind: "relay", ref: ventCommit.id },
          ],
          confidence: 0.93,
          intent: "notify",
          respondsTo: ingressPacket.id,
          dependsOn: [medicCommit.id, ventCommit.id],
          context: ingressPacket.context,
        }),
      });
    }
  }

  return outputs;
}

function handleSafety(context: OriginRuntimeAgentContext): OriginRuntimeDispatch[] {
  const outputs: OriginRuntimeDispatch[] = [];

  for (const packet of context.inbound) {
    const root = rootPacketId(packet.id);
    const room = packet.context?.room ?? "unknown";

    if (packet.kind === "query" && hasClaim(packet, "corridor", "=", "clear")) {
      const corridorClearId = `${root}-a-corridor-clear`;

      if (!context.knownPackets.has(corridorClearId)) {
        const corridorPacket = buildPacket({
          id: corridorClearId,
          agent: "safety",
          kind: "assert",
          claims: [{ subject: "corridor", relation: "=", object: "clear" }],
          evidence: [{ kind: "lidar", ref: `hall-${room}` }],
          confidence: 0.88,
          intent: "verify",
          respondsTo: packet.id,
          context: packet.context,
        });

        outputs.push({ to: "coordinator", packet: corridorPacket });
        outputs.push({ to: "dispatch", packet: corridorPacket });
      }
    }

    if (packet.kind === "propose" && hasClaim(packet, "vent", "=", "on")) {
      const ventCommitId = `${root}-c-vent`;

      if (!context.knownPackets.has(ventCommitId)) {
        outputs.push({
          to: "coordinator",
          packet: buildPacket({
            id: ventCommitId,
            agent: "safety",
            kind: "commit",
            claims: [{ subject: "vent", relation: "=", object: "on" }],
            evidence: [{ kind: "actuator", ref: `hvac-${room}` }],
            confidence: 0.91,
            intent: "act",
            respondsTo: packet.id,
            context: packet.context,
          }),
        });
      }
    }
  }

  return outputs;
}

function handleDispatch(context: OriginRuntimeAgentContext): OriginRuntimeDispatch[] {
  const outputs: OriginRuntimeDispatch[] = [];

  for (const packet of context.inbound) {
    const root = rootPacketId(packet.id);
    const proposalId = `${root}-p-medic`;
    const commitId = `${root}-c-medic`;
    const corridorId = `${root}-a-corridor-clear`;
    const proposal = context.knownPackets.get(proposalId);
    const corridorClear = context.knownPackets.get(corridorId);

    if (!proposal || !corridorClear || context.knownPackets.has(commitId)) {
      continue;
    }

    const medicClaim = proposal.claims.find((claim) => claim.subject === "medic");

    if (!medicClaim) {
      continue;
    }

    outputs.push({
      to: "coordinator",
      packet: buildPacket({
        id: commitId,
        agent: "dispatch",
        kind: "commit",
        claims: [{ subject: "medic", relation: "->", object: medicClaim.object }],
        evidence: [{ kind: "dispatch", ref: "board7" }],
        confidence: 0.9,
        intent: "assist",
        respondsTo: proposal.id,
        dependsOn: [corridorClear.id],
        context: proposal.context,
      }),
    });
  }

  return outputs;
}

function scheduleEnvelope(options: {
  round: number;
  from: string;
  to: string;
  packets: OriginPacketDraft[];
  queue: OriginRuntimeEnvelope[];
  knownPackets: Map<string, OriginPacket>;
}): void {
  const normalizedPackets = options.packets.map((packet) => buildPacket(packet));

  for (const packet of normalizedPackets) {
    const existing = options.knownPackets.get(packet.id);

    if (existing && JSON.stringify(existing) !== JSON.stringify(packet)) {
      throw new Error(`Runtime attempted to reuse packet id '${packet.id}' with different contents.`);
    }

    if (!existing) {
      options.knownPackets.set(packet.id, packet);
    }
  }

  const bundle = encodeFrameWireBundle(normalizedPackets);
  const encoded = encodeFrameWireString(bundle);

  options.queue.push({
    round: options.round,
    from: options.from,
    to: options.to,
    packets: normalizedPackets,
    encoded,
    lexiconSize: bundle.lexicon.length,
    englishBytes: normalizedPackets.reduce(
      (total, packet) => total + estimateUtf8Bytes(renderEnglish(packet)),
      0,
    ),
    frameWireBytes: estimateFrameWireBytes(bundle),
  });
}

function groupDispatches(dispatches: OriginRuntimeDispatch[]): Map<string, OriginPacket[]> {
  const grouped = new Map<string, OriginPacket[]>();

  for (const dispatch of dispatches) {
    grouped.set(dispatch.to, [...(grouped.get(dispatch.to) ?? []), dispatch.packet]);
  }

  return grouped;
}

function buildPacket(packet: OriginPacketDraft): OriginPacket {
  const normalized = canonicalizePacket({
    version: "O1",
    ...packet,
  });
  validatePacket(normalized);
  return normalized;
}

function hasClaim(
  packet: OriginPacket,
  subject: string,
  relation: OriginPacket["claims"][number]["relation"],
  object: string,
): boolean {
  return packet.claims.some(
    (claim) =>
      claim.subject === subject &&
      claim.relation === relation &&
      claim.object === object,
  );
}

function findPacket(
  packets: OriginPacket[],
  predicate: (packet: OriginPacket) => boolean,
): OriginPacket | undefined {
  return packets.find(predicate);
}

function rootPacketId(id: string): string {
  const match = /^(.+?)-(?:q-corridor|p-vent|p-medic|a-corridor-clear|c-vent|c-medic|n-summary)$/.exec(
    id,
  );

  return match ? match[1] : id;
}
