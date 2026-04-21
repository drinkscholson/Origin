import type { OriginIntent, OriginKind } from "./model.js";

export const KIND_TO_CODE: Record<OriginKind, string> = {
  assert: "a",
  query: "q",
  propose: "p",
  commit: "c",
  revise: "r",
  reject: "x",
};

export const CODE_TO_KIND = invertMap(KIND_TO_CODE);

export const INTENT_TO_CODE: Record<OriginIntent, string> = {
  observe: "obs",
  verify: "vrf",
  act: "act",
  assist: "ast",
  hold: "hld",
  merge: "mrg",
  notify: "ntf",
  escalate: "esl",
};

export const CODE_TO_INTENT = invertMap(INTENT_TO_CODE);

function invertMap<TValue extends string>(
  map: Record<string, TValue>,
): Record<TValue, string> {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [value, key]),
  ) as Record<TValue, string>;
}
