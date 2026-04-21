import type { OriginPacket } from "./model.js";

export const EXAMPLES: OriginPacket[] = [
  {
    version: "O1",
    id: "pkt-001",
    agent: "self",
    kind: "assert",
    claims: [
      { subject: "door", relation: "=", object: "open" },
      { subject: "alarm", relation: "=", object: "off" },
    ],
    evidence: [{ kind: "cam", ref: "12@14:03" }],
    confidence: 0.91,
    intent: "observe",
    context: { room: "A" },
  },
  {
    version: "O1",
    id: "pkt-002",
    agent: "peer7",
    kind: "propose",
    claims: [
      { subject: "user", relation: "=", object: "distress" },
      { subject: "medic", relation: "->", object: "roomC" },
    ],
    evidence: [
      { kind: "voice", ref: "44" },
      { kind: "text", ref: "88" },
    ],
    confidence: 0.83,
    intent: "assist",
    context: { priority: "high", room: "C" },
  },
  {
    version: "O1",
    id: "pkt-003",
    agent: "memory",
    kind: "revise",
    claims: [{ subject: "route", relation: "!=", object: "safe" }],
    evidence: [{ kind: "log", ref: "2231" }],
    confidence: 0.66,
    intent: "verify",
    respondsTo: "pkt-002",
    conflicts: ["c12"],
    context: { task: "navigation" },
  },
];
