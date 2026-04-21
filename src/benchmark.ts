import { encodePacket, estimateUtf8Bytes } from "./codec.js";
import { EXAMPLES } from "./examples.js";
import { renderEnglish } from "./render.js";

const rows = EXAMPLES.map((packet, index) => {
  const english = renderEnglish(packet);
  const origin = encodePacket(packet);
  const englishBytes = estimateUtf8Bytes(english);
  const originBytes = estimateUtf8Bytes(origin);

  return {
    case: `example-${index + 1}`,
    englishBytes,
    originBytes,
    savedBytes: englishBytes - originBytes,
    ratio: `${((1 - originBytes / englishBytes) * 100).toFixed(1)}%`,
  };
});

console.table(rows);

const totals = rows.reduce(
  (accumulator, row) => {
    accumulator.englishBytes += row.englishBytes;
    accumulator.originBytes += row.originBytes;
    return accumulator;
  },
  { englishBytes: 0, originBytes: 0 },
);

const totalSaved = totals.englishBytes - totals.originBytes;
const totalRatio = ((1 - totals.originBytes / totals.englishBytes) * 100).toFixed(1);

console.log("");
console.log(`Total English bytes: ${totals.englishBytes}`);
console.log(`Total Origin bytes : ${totals.originBytes}`);
console.log(`Saved bytes        : ${totalSaved}`);
console.log(`Compression gain   : ${totalRatio}%`);
