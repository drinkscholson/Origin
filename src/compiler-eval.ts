import { canonicalizePacket } from "./codec.js";
import { compileEnglishPacket } from "./compiler.js";
import { COMPILER_EVAL_CASES } from "./compiler-eval-cases.js";

interface EvalRow {
  id: string;
  status: "pass" | "fail";
  detail: string;
}

const rows: EvalRow[] = [];

for (const testCase of COMPILER_EVAL_CASES) {
  try {
    const result = compileEnglishPacket(testCase.input);

    if (testCase.expectError) {
      rows.push({
        id: testCase.id,
        status: "fail",
        detail: `Expected error '${testCase.expectError}' but compilation succeeded.`,
      });
      continue;
    }

    const expectedPacket = canonicalizePacket(testCase.expectedPacket!);
    const actualPacket = canonicalizePacket(result.packet);
    const actualAssumptions = [...result.assumptions.map((item) => item.code)].sort();
    const expectedAssumptions = [...(testCase.expectedAssumptionCodes ?? [])].sort();

    const packetMatches = JSON.stringify(actualPacket) === JSON.stringify(expectedPacket);
    const assumptionMatches =
      JSON.stringify(actualAssumptions) === JSON.stringify(expectedAssumptions);
    const deterministic =
      JSON.stringify(compileEnglishPacket(testCase.input).packet) === JSON.stringify(result.packet);

    if (packetMatches && assumptionMatches && deterministic) {
      rows.push({
        id: testCase.id,
        status: "pass",
        detail: testCase.description,
      });
    } else {
      rows.push({
        id: testCase.id,
        status: "fail",
        detail: buildMismatchDetail(packetMatches, assumptionMatches, deterministic, {
          actualPacket,
          expectedPacket,
          actualAssumptions,
          expectedAssumptions,
        }),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (testCase.expectError && message === testCase.expectError) {
      rows.push({
        id: testCase.id,
        status: "pass",
        detail: testCase.description,
      });
    } else {
      rows.push({
        id: testCase.id,
        status: "fail",
        detail: `Unexpected error: ${message}`,
      });
    }
  }
}

console.table(rows);

const failed = rows.filter((row) => row.status === "fail");

console.log("");
console.log(`Compiler evaluation: ${rows.length - failed.length}/${rows.length} passed`);

if (failed.length > 0) {
  console.log("");
  console.log("Failures");

  for (const row of failed) {
    console.log(`- ${row.id}: ${row.detail}`);
  }

  process.exit(1);
}

function buildMismatchDetail(
  packetMatches: boolean,
  assumptionMatches: boolean,
  deterministic: boolean,
  details: {
    actualPacket: unknown;
    expectedPacket: unknown;
    actualAssumptions: string[];
    expectedAssumptions: string[];
  },
): string {
  const parts: string[] = [];

  if (!packetMatches) {
    parts.push(
      `packet mismatch expected=${JSON.stringify(details.expectedPacket)} actual=${JSON.stringify(details.actualPacket)}`,
    );
  }

  if (!assumptionMatches) {
    parts.push(
      `assumption mismatch expected=${JSON.stringify(details.expectedAssumptions)} actual=${JSON.stringify(details.actualAssumptions)}`,
    );
  }

  if (!deterministic) {
    parts.push("compiler output is not deterministic across repeated runs");
  }

  return parts.join(" | ");
}
