import { encodePacket } from "./codec.js";
import { DEFAULT_RUNTIME_INPUT, runDefaultRuntimeSession } from "./runtime.js";

const session = runDefaultRuntimeSession(DEFAULT_RUNTIME_INPUT);

console.log("Origin FW1-first runtime demo");
console.log("");
console.log(`Ingress English : ${session.ingressEnglish}`);
console.log(`Ingress Packet  : ${encodePacket(session.ingressPacket)}`);
console.log("");
console.log(`Transport mode  : ${session.transportMode}`);
console.log("");

for (const transport of session.transports) {
  console.log(`Round ${transport.round}: ${transport.from} -> ${transport.to}`);
  console.log(`Lexicon size : ${transport.lexiconSize}`);
  console.log(`English bytes: ${transport.englishBytes}`);
  console.log(`FW1 bytes    : ${transport.frameWireBytes}`);
  console.log(transport.encoded);
  console.log("");
}

console.log("Final gateway packets");
console.log("");

for (const packet of session.finalPackets) {
  console.log(encodePacket(packet));
}

console.log("");
console.table([
  { metric: "Delivered packets", value: session.memory.length },
  { metric: "Transport envelopes", value: session.transports.length },
  { metric: "Reference issues", value: session.ledger.referenceIssues.length },
  { metric: "Derived conflicts", value: session.ledger.derivedConflicts.length },
  { metric: "Internal English bytes", value: session.totalEnglishBytes },
  { metric: "Internal FW1 bytes", value: session.totalFrameWireBytes },
  {
    metric: "FW1 vs English",
    value: `${((1 - session.totalFrameWireBytes / session.totalEnglishBytes) * 100).toFixed(1)}%`,
  },
]);
