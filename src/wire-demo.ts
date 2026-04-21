import { canonicalizePacket, encodePacket, estimateUtf8Bytes } from "./codec.js";
import { EXAMPLES } from "./examples.js";
import { renderEnglish } from "./render.js";
import {
  decodeWireBundle,
  encodeWireBundle,
  encodeWireString,
  estimateWireBytes,
  parseWireString,
} from "./wire.js";

const bundle = encodeWireBundle(EXAMPLES);
const wireString = encodeWireString(bundle);
const parsedBundle = parseWireString(wireString);
const decoded = decodeWireBundle(parsedBundle);
const canonicalExamples = EXAMPLES.map((packet) => canonicalizePacket(packet));

console.log("Origin machine-native wire demo");
console.log("");
console.log(`Lexicon: ${JSON.stringify(bundle.lexicon)}`);
console.log("");
console.log("Wire bundle");
console.log(wireString);
console.log("");
console.log(
  `Roundtrip: ${JSON.stringify(decoded) === JSON.stringify(canonicalExamples) ? "ok" : "mismatch"}`,
);
console.log("");

for (const [index, packet] of EXAMPLES.entries()) {
  const english = renderEnglish(packet);
  const readable = encodePacket(packet);
  const wire = bundle.packets[index];

  console.log(`Example ${index + 1}`);
  console.log(`English bytes : ${estimateUtf8Bytes(english)}`);
  console.log(`O1 bytes      : ${estimateUtf8Bytes(readable)}`);
  console.log(`W1 packet view: ${JSON.stringify(wire)}`);
  console.log("");
}

console.log(`W1 bundle bytes: ${estimateWireBytes(bundle)}`);
