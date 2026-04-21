import { encodePacket, parsePacket } from "./codec.js";
import { EXAMPLES } from "./examples.js";
import { renderEnglish } from "./render.js";

console.log("Origin language prototype demo");
console.log("");

for (const [index, packet] of EXAMPLES.entries()) {
  const encoded = encodePacket(packet);
  const decoded = parsePacket(encoded);

  console.log(`Example ${index + 1}`);
  console.log(`English : ${renderEnglish(packet)}`);
  console.log(`Origin  : ${encoded}`);
  console.log(`Decoded : ${JSON.stringify(decoded, null, 2)}`);
  console.log("");
}
