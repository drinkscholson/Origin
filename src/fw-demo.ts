import { canonicalizePacket, encodePacket, estimateUtf8Bytes } from "./codec.js";
import { estimateFrameWireBytes, decodeFrameWireBundle, encodeFrameWireBundle, encodeFrameWireString, parseFrameWireString } from "./fw.js";
import { renderEnglish } from "./render.js";
import { summarizeWorkflow } from "./workflow.js";
import { INCIDENT_RESPONSE_WORKFLOW } from "./workflows.js";

const packets = INCIDENT_RESPONSE_WORKFLOW.steps.map((step) => step.packet);
const canonicalPackets = packets.map((packet) => canonicalizePacket(packet));
const summary = summarizeWorkflow(INCIDENT_RESPONSE_WORKFLOW);
const bundle = encodeFrameWireBundle(packets);
const frameWireString = encodeFrameWireString(bundle);
const parsedBundle = parseFrameWireString(frameWireString);
const decodedPackets = decodeFrameWireBundle(parsedBundle);

const englishBytes = packets.reduce(
  (total, packet) => total + estimateUtf8Bytes(renderEnglish(packet)),
  0,
);
const packetBytes = packets.reduce(
  (total, packet) => total + estimateUtf8Bytes(encodePacket(packet)),
  0,
);
const frameBytes = summary.stats.frameTotal;
const frameWireBytes = estimateFrameWireBytes(bundle);

console.log("Origin frame + wire hybrid demo");
console.log("");
console.log(`Frames        : ${bundle.frames.length}`);
console.log(`Lexicon       : ${JSON.stringify(bundle.lexicon)}`);
console.log(
  `Roundtrip     : ${JSON.stringify(decodedPackets) === JSON.stringify(canonicalPackets) ? "ok" : "mismatch"}`,
);
console.log("");
console.log("FW1 bundle");
console.log(frameWireString);
console.log("");
console.table([
  { format: "English", bytes: englishBytes },
  { format: "O1 packets", bytes: packetBytes },
  { format: "F1 frames", bytes: frameBytes },
  { format: "FW1 bundle", bytes: frameWireBytes },
]);
console.log("");
console.log(`FW1 vs English: ${ratio(englishBytes, frameWireBytes)}`);
console.log(`FW1 vs O1     : ${ratio(packetBytes, frameWireBytes)}`);
console.log(`FW1 vs F1     : ${ratio(frameBytes, frameWireBytes)}`);

function ratio(base: number, next: number): string {
  return `${((1 - next / base) * 100).toFixed(1)}%`;
}
