import type { OriginPacket } from "./model.js";

export function renderEnglish(packet: OriginPacket): string {
  const claimText = packet.claims
    .map((claim) => `${claim.subject} ${renderRelation(claim.relation)} ${claim.object}`)
    .join(" and ");

  const evidenceText = packet.evidence
    .map((item) => `${item.kind} ${item.ref}`)
    .join(", ");

  const contextText = Object.entries(packet.context ?? {})
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");

  const pieces = [
    `Packet ${packet.id} from agent ${packet.agent} ${renderKind(packet.kind)} that ${claimText}`,
    `based on ${evidenceText}`,
    `with ${Math.round(packet.confidence * 100)}% confidence`,
    `${capitalize(packet.intent)} next`,
  ];

  if (packet.respondsTo) {
    pieces.push(`responds to ${packet.respondsTo}`);
  }

  if (packet.dependsOn?.length) {
    pieces.push(`depends on ${packet.dependsOn.join(", ")}`);
  }

  if (contextText) {
    pieces.push(`context ${contextText}`);
  }

  if (packet.conflicts?.length) {
    pieces.push(`conflicts ${packet.conflicts.join(", ")}`);
  }

  return `${pieces.join(". ")}.`;
}

function renderRelation(relation: OriginPacket["claims"][number]["relation"]): string {
  switch (relation) {
    case "=":
      return "is";
    case "!=":
      return "is not";
    case ">":
      return "is above";
    case "<":
      return "is below";
    case ">=":
      return "is at least";
    case "<=":
      return "is at most";
    case "->":
      return "routes to";
    default:
      return relation;
  }
}

function renderKind(kind: OriginPacket["kind"]): string {
  switch (kind) {
    case "assert":
      return "asserts";
    case "query":
      return "queries";
    case "propose":
      return "proposes";
    case "commit":
      return "commits";
    case "revise":
      return "revises";
    case "reject":
      return "rejects";
    default:
      return kind;
  }
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
