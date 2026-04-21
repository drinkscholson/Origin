import { canonicalizePacket, encodePacket } from "./codec.js";
import { compileEnglishPacket } from "./compiler.js";
import { EXAMPLES } from "./examples.js";
import { renderEnglish } from "./render.js";

console.log("Origin natural-language compiler demo");
console.log("");

for (const [index, packet] of EXAMPLES.entries()) {
  const english = renderEnglish(packet);
  const result = compileEnglishPacket(english);
  const samePacket =
    JSON.stringify(canonicalizePacket(packet)) === JSON.stringify(result.packet);

  console.log(`Roundtrip example ${index + 1}`);
  console.log(`Source  : ${english}`);
  console.log(`Origin  : ${encodePacket(result.packet)}`);
  console.log(`Roundtrip: ${samePacket ? "ok" : "mismatch"}`);
  console.log("");
}

const inferred = compileEnglishPacket(
  "Agent analyst proposes that service door is open and medic routes to room A. Context incident HX77, room A.",
);

console.log("Inference example");
console.log(
  "Source  : Agent analyst proposes that service door is open and medic routes to room A. Context incident HX77, room A.",
);
console.log(`Origin  : ${encodePacket(inferred.packet)}`);
console.log(`Assumptions: ${inferred.assumptions.map((item) => item.code).join(", ")}`);
