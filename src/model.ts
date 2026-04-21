export type OriginKind =
  | "assert"
  | "query"
  | "propose"
  | "commit"
  | "revise"
  | "reject";

export type OriginIntent =
  | "observe"
  | "verify"
  | "act"
  | "assist"
  | "hold"
  | "merge"
  | "notify"
  | "escalate";

export type OriginRelation = "=" | "!=" | ">" | "<" | ">=" | "<=" | "->";

export interface OriginClaim {
  subject: string;
  relation: OriginRelation;
  object: string;
}

export interface OriginEvidence {
  kind: string;
  ref: string;
}

export type OriginContext = Record<string, string>;

export interface OriginPacket {
  version: "O1";
  id: string;
  agent: string;
  kind: OriginKind;
  claims: OriginClaim[];
  evidence: OriginEvidence[];
  confidence: number;
  intent: OriginIntent;
  respondsTo?: string;
  dependsOn?: string[];
  conflicts?: string[];
  context?: OriginContext;
}
