import { encodePacket, estimateUtf8Bytes } from "./codec.js";
import { encodeFrameWireBundle, estimateFrameWireBytes } from "./fw.js";
import { renderEnglish } from "./render.js";
import { summarizeWorkflow } from "./workflow.js";
import { WORKFLOW_CORPUS } from "./workflows.js";
import { encodeWireBundle, estimateWireBytes } from "./wire.js";

const rows = WORKFLOW_CORPUS.map((workflow) => {
  const packets = workflow.steps.map((step) => step.packet);
  const summary = summarizeWorkflow(workflow);
  const wireBundle = encodeWireBundle(packets);
  const frameWireBundle = encodeFrameWireBundle(packets);

  const englishBytes = packets.reduce(
    (total, packet) => total + estimateUtf8Bytes(renderEnglish(packet)),
    0,
  );
  const packetBytes = packets.reduce(
    (total, packet) => total + estimateUtf8Bytes(encodePacket(packet)),
    0,
  );
  const frameBytes = summary.stats.frameTotal;
  const wireBytes = estimateWireBytes(wireBundle);
  const frameWireBytes = estimateFrameWireBytes(frameWireBundle);

  return {
    workflow: workflow.id,
    steps: packets.length,
    frames: summary.frames.length,
    englishBytes,
    packetBytes,
    frameBytes,
    wireBytes,
    frameWireBytes,
    fwLexicon: frameWireBundle.lexicon.length,
    fwMode: frameWireBundle.lexicon.length > 0 ? "lexicon" : "frame-only",
    fwSavings: ratio(englishBytes, frameWireBytes),
  };
});

const totals = rows.reduce(
  (accumulator, row) => ({
    steps: accumulator.steps + row.steps,
    frames: accumulator.frames + row.frames,
    englishBytes: accumulator.englishBytes + row.englishBytes,
    packetBytes: accumulator.packetBytes + row.packetBytes,
    frameBytes: accumulator.frameBytes + row.frameBytes,
    wireBytes: accumulator.wireBytes + row.wireBytes,
    frameWireBytes: accumulator.frameWireBytes + row.frameWireBytes,
  }),
  {
    steps: 0,
    frames: 0,
    englishBytes: 0,
    packetBytes: 0,
    frameBytes: 0,
    wireBytes: 0,
    frameWireBytes: 0,
  },
);

console.table(rows);
console.log("");
console.table([
  { metric: "Corpus English bytes", value: totals.englishBytes },
  { metric: "Corpus O1 bytes", value: totals.packetBytes },
  { metric: "Corpus F1 bytes", value: totals.frameBytes },
  { metric: "Corpus W1 bytes", value: totals.wireBytes },
  { metric: "Corpus FW1 bytes", value: totals.frameWireBytes },
  { metric: "Corpus FW1 vs English", value: ratio(totals.englishBytes, totals.frameWireBytes) },
  { metric: "Corpus FW1 vs O1", value: ratio(totals.packetBytes, totals.frameWireBytes) },
  { metric: "Corpus FW1 vs F1", value: ratio(totals.frameBytes, totals.frameWireBytes) },
  { metric: "Corpus FW1 vs W1", value: ratio(totals.wireBytes, totals.frameWireBytes) },
]);

function ratio(base: number, next: number): string {
  return `${((1 - next / base) * 100).toFixed(1)}%`;
}
