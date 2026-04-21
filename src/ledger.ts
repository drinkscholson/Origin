import type { OriginClaim, OriginPacket } from "./model.js";

export interface OriginPacketLink {
  fromId: string;
  toId: string;
  type: "respondsTo" | "dependsOn";
}

export interface OriginReferenceIssue {
  fromId: string;
  toId: string;
  type: "respondsTo" | "dependsOn";
  reason: "missing-target" | "forward-reference";
}

export interface OriginDerivedConflict {
  id: string;
  leftId: string;
  rightId: string;
  subject: string;
  reason: string;
  contextSignature: string;
}

export interface OriginLedger {
  packetsById: Map<string, OriginPacket>;
  duplicateIds: string[];
  links: OriginPacketLink[];
  referenceIssues: OriginReferenceIssue[];
  derivedConflicts: OriginDerivedConflict[];
}

export function buildLedger(packets: OriginPacket[]): OriginLedger {
  const packetsById = new Map<string, OriginPacket>();
  const duplicateIds: string[] = [];
  const links: OriginPacketLink[] = [];
  const referenceIssues: OriginReferenceIssue[] = [];
  const indexById = new Map<string, number>();

  for (const [index, packet] of packets.entries()) {
    if (packetsById.has(packet.id)) {
      duplicateIds.push(packet.id);
      continue;
    }

    packetsById.set(packet.id, packet);
    indexById.set(packet.id, index);
  }

  for (const [index, packet] of packets.entries()) {
    if (packet.respondsTo) {
      collectReference(packet.id, packet.respondsTo, "respondsTo", index, indexById, links, referenceIssues);
    }

    for (const dependency of packet.dependsOn ?? []) {
      collectReference(packet.id, dependency, "dependsOn", index, indexById, links, referenceIssues);
    }
  }

  const derivedConflicts = deriveConflicts(packets);

  return {
    packetsById,
    duplicateIds,
    links,
    referenceIssues,
    derivedConflicts,
  };
}

function collectReference(
  fromId: string,
  toId: string,
  type: "respondsTo" | "dependsOn",
  currentIndex: number,
  indexById: Map<string, number>,
  links: OriginPacketLink[],
  issues: OriginReferenceIssue[],
): void {
  const targetIndex = indexById.get(toId);

  if (targetIndex === undefined) {
    issues.push({
      fromId,
      toId,
      type,
      reason: "missing-target",
    });
    return;
  }

  if (targetIndex >= currentIndex) {
    issues.push({
      fromId,
      toId,
      type,
      reason: "forward-reference",
    });
  }

  links.push({
    fromId,
    toId,
    type,
  });
}

function deriveConflicts(packets: OriginPacket[]): OriginDerivedConflict[] {
  const conflicts: OriginDerivedConflict[] = [];

  for (let leftIndex = 0; leftIndex < packets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < packets.length; rightIndex += 1) {
      const left = packets[leftIndex];
      const right = packets[rightIndex];

      if (contextSignature(left) !== contextSignature(right)) {
        continue;
      }

      for (const leftClaim of left.claims) {
        for (const rightClaim of right.claims) {
          const reason = detectClaimConflict(leftClaim, rightClaim);

          if (!reason) {
            continue;
          }

          conflicts.push({
            id: `auto:${left.id}:${right.id}:${leftClaim.subject}`,
            leftId: left.id,
            rightId: right.id,
            subject: leftClaim.subject,
            reason,
            contextSignature: contextSignature(left),
          });
        }
      }
    }
  }

  return conflicts;
}

function detectClaimConflict(left: OriginClaim, right: OriginClaim): string | undefined {
  if (left.subject !== right.subject) {
    return undefined;
  }

  if (left.relation === "=" && right.relation === "!=" && left.object === right.object) {
    return "Equality conflicts with inequality on the same object.";
  }

  if (left.relation === "!=" && right.relation === "=" && left.object === right.object) {
    return "Inequality conflicts with equality on the same object.";
  }

  if (
    left.relation === right.relation &&
    (left.relation === "=" || left.relation === "->") &&
    left.object !== right.object
  ) {
    return "The same subject is assigned to different objects in the same context.";
  }

  const leftRange = toRange(left);
  const rightRange = toRange(right);

  if (leftRange && rightRange && rangesConflict(leftRange, rightRange)) {
    return "Numeric constraints do not overlap.";
  }

  return undefined;
}

function toRange(claim: OriginClaim):
  | { min: number; minInclusive: boolean; max: number; maxInclusive: boolean }
  | undefined {
  const numeric = Number(claim.object);

  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  switch (claim.relation) {
    case "=":
      return { min: numeric, minInclusive: true, max: numeric, maxInclusive: true };
    case ">":
      return { min: numeric, minInclusive: false, max: Number.POSITIVE_INFINITY, maxInclusive: false };
    case ">=":
      return { min: numeric, minInclusive: true, max: Number.POSITIVE_INFINITY, maxInclusive: false };
    case "<":
      return { min: Number.NEGATIVE_INFINITY, minInclusive: false, max: numeric, maxInclusive: false };
    case "<=":
      return { min: Number.NEGATIVE_INFINITY, minInclusive: false, max: numeric, maxInclusive: true };
    default:
      return undefined;
  }
}

function rangesConflict(
  left: { min: number; minInclusive: boolean; max: number; maxInclusive: boolean },
  right: { min: number; minInclusive: boolean; max: number; maxInclusive: boolean },
): boolean {
  const intersectionMin = Math.max(left.min, right.min);
  const intersectionMax = Math.min(left.max, right.max);

  if (intersectionMin > intersectionMax) {
    return true;
  }

  if (intersectionMin < intersectionMax) {
    return false;
  }

  const leftAllowsBoundary =
    (left.min < intersectionMin || left.minInclusive) &&
    (left.max > intersectionMax || left.maxInclusive);
  const rightAllowsBoundary =
    (right.min < intersectionMin || right.minInclusive) &&
    (right.max > intersectionMax || right.maxInclusive);

  return !(leftAllowsBoundary && rightAllowsBoundary);
}

function contextSignature(packet: OriginPacket): string {
  return Object.entries(packet.context ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
}
