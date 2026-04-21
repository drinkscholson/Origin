import { stdin as input, stdout as output } from "node:process";

import { encodePacket } from "./codec.js";
import { compileEnglishPacket } from "./compiler.js";

const source = process.argv.slice(2).join(" ").trim() || (await readStdin()).trim();

if (!source) {
  console.error("Usage: npm run compile -- \"Agent self asserts that door is open based on cam 12 with 91% confidence. Observe next.\"");
  process.exit(1);
}

const result = compileEnglishPacket(source);

console.log("Source");
console.log(source);
console.log("");
console.log("Packet");
console.log(JSON.stringify(result.packet, null, 2));
console.log("");
console.log("Origin");
console.log(encodePacket(result.packet));

if (result.assumptions.length > 0) {
  console.log("");
  console.log("Assumptions");

  for (const assumption of result.assumptions) {
    console.log(`- ${assumption.code}: ${assumption.message}`);
  }
}

async function readStdin(): Promise<string> {
  if (input.isTTY) {
    return "";
  }

  let data = "";

  for await (const chunk of input) {
    data += chunk;
  }

  output.write("");
  return data;
}
