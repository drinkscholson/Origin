import { encodePacket, estimateUtf8Bytes } from "./codec.js";
import type { OriginPacket } from "./model.js";

export type OriginDiagnosticSeverity = "info" | "warning" | "error";

export interface OriginDiagnostic {
  code: string;
  severity: OriginDiagnosticSeverity;
  message: string;
}

export interface PacketDiagnostics {
  packet: OriginPacket;
  diagnostics: OriginDiagnostic[];
}

export function analyzePacket(
  packet: OriginPacket,
  options?: { previous?: OriginPacket },
): OriginDiagnostic[] {
  const diagnostics: OriginDiagnostic[] = [];
  const encoded = encodePacket(packet);
  const size = estimateUtf8Bytes(encoded);

  if (size > 96) {
    diagnostics.push({
      code: "large-packet",
      severity: "warning",
      message:
        "Packet is large for routine agent traffic. Consider splitting claims or using a shared frame header.",
    });
  }

  if (packet.confidence < 0.7 && !packet.conflicts?.length && packet.kind !== "query") {
    diagnostics.push({
      code: "low-confidence-without-conflict",
      severity: "warning",
      message:
        "Low-confidence packet has no conflict marker. Machines should know whether this is disputed or merely uncertain.",
    });
  }

  if (packet.claims.length > 4) {
    diagnostics.push({
      code: "overloaded-claim-bundle",
      severity: "warning",
      message:
        "Too many claims are bundled into one packet. This increases merge and rollback complexity.",
    });
  }

  if (hasDuplicateEvidence(packet)) {
    diagnostics.push({
      code: "duplicate-evidence",
      severity: "warning",
      message: "Packet repeats the same evidence reference more than once.",
    });
  }

  if (options?.previous && isFrameCandidate(options.previous, packet)) {
    diagnostics.push({
      code: "frame-candidate",
      severity: "info",
      message:
        "Packet shares agent, evidence, and context with the previous packet. A frame header can compress this burst.",
    });
  }

  if ((packet.kind === "revise" || packet.kind === "reject") && !packet.respondsTo) {
    diagnostics.push({
      code: "missing-response-reference",
      severity: "error",
      message: "Revision and rejection packets must identify the packet they target.",
    });
  }

  if (packet.kind === "commit" && !packet.respondsTo) {
    diagnostics.push({
      code: "commit-without-anchor",
      severity: "warning",
      message:
        "Commit packets are stronger when anchored to a prior proposal, query, or alert.",
    });
  }

  return diagnostics;
}

export function analyzeWorkflow(packets: OriginPacket[]): PacketDiagnostics[] {
  return packets.map((packet, index) => ({
    packet,
    diagnostics: analyzePacket(packet, {
      previous: index > 0 ? packets[index - 1] : undefined,
    }),
  }));
}

export function isFrameCandidate(left: OriginPacket, right: OriginPacket): boolean {
  return (
    left.agent === right.agent &&
    serializeEvidence(left) === serializeEvidence(right) &&
    serializeContext(left) === serializeContext(right)
  );
}

function hasDuplicateEvidence(packet: OriginPacket): boolean {
  const seen = new Set<string>();

  for (const item of packet.evidence) {
    const key = `${item.kind}:${item.ref}`;

    if (seen.has(key)) {
      return true;
    }

    seen.add(key);
  }

  return false;
}

function serializeEvidence(packet: OriginPacket): string {
  return packet.evidence.map((item) => `${item.kind}:${item.ref}`).join("|");
}

function serializeContext(packet: OriginPacket): string {
  return Object.entries(packet.context ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
}
