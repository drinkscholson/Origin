import { canonicalizePacket, encodePacket, estimateUtf8Bytes } from "./codec.js";
import { analyzeWorkflow } from "./diagnostics.js";
import {
  encodeFrame,
  groupPacketsIntoFrames,
  materializeFrame,
  parseFrame,
} from "./frame.js";
import { buildLedger } from "./ledger.js";
import type { OriginPacket } from "./model.js";
import { renderEnglish } from "./render.js";

export interface OriginWorkflowStep {
  id: string;
  label: string;
  packet: OriginPacket;
}

export interface OriginWorkflow {
  id: string;
  title: string;
  summary: string;
  steps: OriginWorkflowStep[];
}

export function summarizeWorkflow(workflow: OriginWorkflow) {
  const packets = workflow.steps.map((step) => canonicalizePacket(step.packet));
  const frames = groupPacketsIntoFrames(packets);
  const ledger = buildLedger(packets);
  const englishTotal = workflow.steps.reduce(
    (total, step) => total + estimateUtf8Bytes(renderEnglish(step.packet)),
    0,
  );
  const packetTotal = packets.reduce(
    (total, packet) => total + estimateUtf8Bytes(encodePacket(packet)),
    0,
  );
  const frameTotal = frames.reduce(
    (total, frame) => total + estimateUtf8Bytes(encodeFrame(frame)),
    0,
  );

  return {
    diagnostics: analyzeWorkflow(packets),
    ledger,
    packets,
    frames,
    frameRoundTripOk: frames.every((frame) => {
      const decoded = parseFrame(encodeFrame(frame));
      return JSON.stringify(materializeFrame(decoded)) === JSON.stringify(materializeFrame(frame));
    }),
    stats: {
      englishTotal,
      packetTotal,
      frameTotal,
      packetSavings: percentageSaved(englishTotal, packetTotal),
      frameSavings: percentageSaved(englishTotal, frameTotal),
      frameVsPacketSavings: percentageSaved(packetTotal, frameTotal),
    },
  };
}

function percentageSaved(base: number, next: number): string {
  if (base === 0) {
    return "0.0%";
  }

  return `${((1 - next / base) * 100).toFixed(1)}%`;
}
