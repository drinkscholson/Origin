import type { OriginPacket } from "./model.js";

export interface CompilerEvalCase {
  id: string;
  description: string;
  input: string;
  expectedPacket?: OriginPacket;
  expectedAssumptionCodes?: string[];
  expectError?: string;
}

export const COMPILER_EVAL_CASES: CompilerEvalCase[] = [
  {
    id: "assert-basic",
    description: "Compiles a simple assertion with explicit evidence, confidence, and intent.",
    input:
      "Packet pkt-101 from agent self asserts that door is open based on camera 12@14:03 with 91% confidence. Observe next. Context room A.",
    expectedPacket: {
      version: "O1",
      id: "pkt-101",
      agent: "self",
      kind: "assert",
      claims: [{ subject: "door", relation: "=", object: "open" }],
      evidence: [{ kind: "cam", ref: "12@14:03" }],
      confidence: 0.91,
      intent: "observe",
      context: { room: "A" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "bundle-claims",
    description: "Compiles bundled claims with shared provenance.",
    input:
      "Packet hx21-p1 from agent self asserts that door is open and alarm is off based on cam 12@14:03 with 91% confidence. Observe next. Context incident HX21, room A.",
    expectedPacket: {
      version: "O1",
      id: "hx21-p1",
      agent: "self",
      kind: "assert",
      claims: [
        { subject: "door", relation: "=", object: "open" },
        { subject: "alarm", relation: "=", object: "off" },
      ],
      evidence: [{ kind: "cam", ref: "12@14:03" }],
      confidence: 0.91,
      intent: "observe",
      context: { incident: "HX21", room: "A" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "query-at-least",
    description: "Compiles a query packet with a >= relation.",
    input:
      "Packet q-201 from agent sensor9 queries that heat is at least 42 based on sensor 9 with 77% confidence. Verify next. Context room A.",
    expectedPacket: {
      version: "O1",
      id: "q-201",
      agent: "sensor9",
      kind: "query",
      claims: [{ subject: "heat", relation: ">=", object: "42" }],
      evidence: [{ kind: "sensor", ref: "9" }],
      confidence: 0.77,
      intent: "verify",
      context: { room: "A" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "assert-inequality",
    description: "Compiles a != relation from controlled English.",
    input:
      "Packet nav-12 from agent memory asserts that route is not safe based on log 2231 with 66% confidence. Notify next. Context task nav-7.",
    expectedPacket: {
      version: "O1",
      id: "nav-12",
      agent: "memory",
      kind: "assert",
      claims: [{ subject: "route", relation: "!=", object: "safe" }],
      evidence: [{ kind: "log", ref: "2231" }],
      confidence: 0.66,
      intent: "notify",
      context: { task: "nav-7" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "commit-with-links",
    description: "Compiles workflow references using respondsTo and dependsOn.",
    input:
      "Packet hx21-p5 from agent peer7 commits that medic routes to roomA based on text 88 and voice 44 with 86% confidence. Assist next. Responds to hx21-p4. Depends on hx21-p3. Context incident HX21, priority high, room A.",
    expectedPacket: {
      version: "O1",
      id: "hx21-p5",
      agent: "peer7",
      kind: "commit",
      claims: [{ subject: "medic", relation: "->", object: "roomA" }],
      evidence: [
        { kind: "text", ref: "88" },
        { kind: "voice", ref: "44" },
      ],
      confidence: 0.86,
      intent: "assist",
      respondsTo: "hx21-p4",
      dependsOn: ["hx21-p3"],
      context: { incident: "HX21", priority: "high", room: "A" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "semicolon-normalization",
    description: "Normalizes semicolon-delimited controlled English into a valid packet.",
    input:
      "Packet press-1 from agent self asserts that pressure is below 30; based on sensor 9; with 63% confidence; verify next; context room B.",
    expectedPacket: {
      version: "O1",
      id: "press-1",
      agent: "self",
      kind: "assert",
      claims: [{ subject: "pressure", relation: "<", object: "30" }],
      evidence: [{ kind: "sensor", ref: "9" }],
      confidence: 0.63,
      intent: "verify",
      context: { room: "B" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "colon-evidence",
    description: "Accepts compact evidence syntax with a colon separator.",
    input:
      "Packet pkt-cam from agent self asserts that door is open based on cam:12@14:03 with 91% confidence. Observe next. Context room A.",
    expectedPacket: {
      version: "O1",
      id: "pkt-cam",
      agent: "self",
      kind: "assert",
      claims: [{ subject: "door", relation: "=", object: "open" }],
      evidence: [{ kind: "cam", ref: "12@14:03" }],
      confidence: 0.91,
      intent: "observe",
      context: { room: "A" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "defaults",
    description: "Injects defaults when evidence, confidence, and intent are missing.",
    input:
      "Agent analyst proposes that service door is open and medic routes to room A. Context incident HX77, room A.",
    expectedPacket: {
      version: "O1",
      id: "auto-analyst-propose-service-door-4f481d46",
      agent: "analyst",
      kind: "propose",
      claims: [
        { subject: "service-door", relation: "=", object: "open" },
        { subject: "medic", relation: "->", object: "room-A" },
      ],
      evidence: [{ kind: "human", ref: "prompt-4f481d46" }],
      confidence: 0.5,
      intent: "act",
      context: { incident: "HX77", room: "A" },
    },
    expectedAssumptionCodes: [
      "generated-id",
      "default-evidence",
      "default-confidence",
      "default-intent",
    ],
  },
  {
    id: "query-default-intent",
    description: "Infers the default verify intent for query packets when omitted.",
    input:
      "Packet q-202 from agent analyst queries that oxygen is at most 18 based on sensor 4 with 55% confidence. Context room D.",
    expectedPacket: {
      version: "O1",
      id: "q-202",
      agent: "analyst",
      kind: "query",
      claims: [{ subject: "oxygen", relation: "<=", object: "18" }],
      evidence: [{ kind: "sensor", ref: "4" }],
      confidence: 0.55,
      intent: "verify",
      context: { room: "D" },
    },
    expectedAssumptionCodes: ["default-intent"],
  },
  {
    id: "revise-with-conflict",
    description: "Compiles a revise packet with respondsTo and conflicts.",
    input:
      "Packet hx21-p7 from agent peer7 revises that medic routes to serviceEntry based on text 88 and voice 44 with 78% confidence. Assist next. Responds to hx21-p5. Depends on hx21-p6. Context incident HX21, priority high, room A. Conflicts c-route.",
    expectedPacket: {
      version: "O1",
      id: "hx21-p7",
      agent: "peer7",
      kind: "revise",
      claims: [{ subject: "medic", relation: "->", object: "serviceEntry" }],
      evidence: [
        { kind: "text", ref: "88" },
        { kind: "voice", ref: "44" },
      ],
      confidence: 0.78,
      intent: "assist",
      respondsTo: "hx21-p5",
      dependsOn: ["hx21-p6"],
      conflicts: ["c-route"],
      context: { incident: "HX21", priority: "high", room: "A" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "multi-dependency-conflict-list",
    description: "Compiles multiple dependencies and conflicts in one packet.",
    input:
      "Packet hx21-p9 from agent peer7 commits that medic routes to serviceEntry based on text 88 and voice 44 with 82% confidence. Assist next. Responds to hx21-p7. Depends on hx21-p5 and hx21-p6. Context incident HX21, priority high, room A. Conflicts c-route and c-delay.",
    expectedPacket: {
      version: "O1",
      id: "hx21-p9",
      agent: "peer7",
      kind: "commit",
      claims: [{ subject: "medic", relation: "->", object: "serviceEntry" }],
      evidence: [
        { kind: "text", ref: "88" },
        { kind: "voice", ref: "44" },
      ],
      confidence: 0.82,
      intent: "assist",
      respondsTo: "hx21-p7",
      dependsOn: ["hx21-p5", "hx21-p6"],
      conflicts: ["c-delay", "c-route"],
      context: { incident: "HX21", priority: "high", room: "A" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "reject-with-response",
    description: "Compiles a reject packet that targets a prior packet.",
    input:
      "Packet hx21-p8 from agent peer7 rejects that corridor is clear based on text 88 with 72% confidence. Hold next. Responds to hx21-p6. Context incident HX21, room A.",
    expectedPacket: {
      version: "O1",
      id: "hx21-p8",
      agent: "peer7",
      kind: "reject",
      claims: [{ subject: "corridor", relation: "=", object: "clear" }],
      evidence: [{ kind: "text", ref: "88" }],
      confidence: 0.72,
      intent: "hold",
      respondsTo: "hx21-p6",
      context: { incident: "HX21", room: "A" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "evidence-aliases",
    description: "Normalizes evidence aliases such as microphone and logs.",
    input:
      "Packet diag-1 from agent monitor asserts that noise is above 70 based on microphone 7 and logs 3301 with 74% confidence. Notify next. Context room C.",
    expectedPacket: {
      version: "O1",
      id: "diag-1",
      agent: "monitor",
      kind: "assert",
      claims: [{ subject: "noise", relation: ">", object: "70" }],
      evidence: [
        { kind: "log", ref: "3301" },
        { kind: "mic", ref: "7" },
      ],
      confidence: 0.74,
      intent: "notify",
      context: { room: "C" },
    },
    expectedAssumptionCodes: [],
  },
  {
    id: "generated-id-no-context",
    description: "Generates a deterministic id when the packet omits an explicit id.",
    input:
      "Agent monitor asserts that fan is on based on sensor 7 with 64% confidence. Notify next.",
    expectedPacket: {
      version: "O1",
      id: "auto-monitor-assert-fan-98970174",
      agent: "monitor",
      kind: "assert",
      claims: [{ subject: "fan", relation: "=", object: "on" }],
      evidence: [{ kind: "sensor", ref: "7" }],
      confidence: 0.64,
      intent: "notify",
    },
    expectedAssumptionCodes: ["generated-id"],
  },
  {
    id: "invalid-header",
    description: "Rejects unsupported free-form headers.",
    input: "Door looks open from camera 12.",
    expectError:
      "English packet must start with 'Agent <agent> <kind> that ...' or 'Packet <id> from agent <agent> <kind> that ...'.",
  },
  {
    id: "invalid-claim",
    description: "Rejects claims that cannot map to an Origin relation.",
    input:
      "Agent self asserts that door looks open based on camera 12 with 91% confidence. Observe next.",
    expectError: "Unsupported claim phrase: door looks open",
  },
  {
    id: "revise-missing-response",
    description: "Rejects revise packets that do not name a response target.",
    input:
      "Packet bad-r1 from agent peer7 revises that medic routes to roomB based on text 88 with 78% confidence. Assist next. Context incident HX21.",
    expectError: "revise packets require a response reference.",
  },
  {
    id: "invalid-evidence-item",
    description: "Rejects malformed evidence items.",
    input:
      "Packet bad-e1 from agent self asserts that door is open based on camera with 91% confidence. Observe next.",
    expectError: "Invalid evidence item: camera",
  },
];
