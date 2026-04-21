import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface BootstrapOptions {
  includeQuickstart?: boolean;
  includePlaybook?: boolean;
  includeDrills?: boolean;
  drillLimit?: number;
  tokenBudget?: number;
  outputPath?: string;
}

export interface BootstrapBuildResult {
  content: string;
  estimatedTokens: number;
  tokenBudget?: number;
  includedSections: string[];
  omittedSections: string[];
  includedDrillCount: number;
  budgetSatisfied: boolean;
}

const ROOT = process.cwd();
const SYSTEM_PROMPT_PATH = resolve(ROOT, "prompts", "origin-agent-system.md");
const QUICKSTART_PATH = resolve(ROOT, "docs", "agent-quickstart.md");
const PLAYBOOK_PATH = resolve(ROOT, "docs", "agent-playbook.md");
const DRILLS_PATH = resolve(ROOT, "docs", "agent-drills.md");

export function buildAgentBootstrapContext(
  options: BootstrapOptions = {},
): string {
  return buildAgentBootstrapBundle(options).content;
}

export function buildAgentBootstrapBundle(
  options: BootstrapOptions = {},
): BootstrapBuildResult {
  const availableDrills = extractDrillBlocks(stripLeadingTitle(readMarkdown(DRILLS_PATH)));
  const state = {
    includeIntro: true,
    includeQuickstart: options.includeQuickstart ?? true,
    includePlaybook: options.includePlaybook ?? true,
    includeDrills: options.includeDrills ?? true,
    includedDrillCount:
      options.includeDrills === false
        ? 0
        : Math.min(options.drillLimit ?? availableDrills.length, availableDrills.length),
  };

  let result = assembleBootstrapBundle(state, availableDrills, options.tokenBudget);

  if (options.tokenBudget) {
    while (result.estimatedTokens > options.tokenBudget && state.includedDrillCount > 0) {
      state.includedDrillCount -= 1;
      result = assembleBootstrapBundle(state, availableDrills, options.tokenBudget);
    }

    if (result.estimatedTokens > options.tokenBudget && state.includePlaybook) {
      state.includePlaybook = false;
      result = assembleBootstrapBundle(state, availableDrills, options.tokenBudget);
    }

    if (result.estimatedTokens > options.tokenBudget && state.includeQuickstart) {
      state.includeQuickstart = false;
      result = assembleBootstrapBundle(state, availableDrills, options.tokenBudget);
    }

    if (result.estimatedTokens > options.tokenBudget && state.includeIntro) {
      state.includeIntro = false;
      result = assembleBootstrapBundle(state, availableDrills, options.tokenBudget);
    }
  }

  if (options.outputPath) {
    const absolutePath = resolve(ROOT, options.outputPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, result.content, "utf8");
  }

  return result;
}

export function estimateModelTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

function readMarkdown(path: string): string {
  return readFileSync(path, "utf8").trim();
}

function stripLeadingTitle(content: string): string {
  return content.replace(/^# .+\r?\n\r?\n/, "").trim();
}

function assembleBootstrapBundle(
  state: {
    includeIntro: boolean;
    includeQuickstart: boolean;
    includePlaybook: boolean;
    includeDrills: boolean;
    includedDrillCount: number;
  },
  availableDrills: string[],
  tokenBudget?: number,
): BootstrapBuildResult {
  const sections: string[] = ["# Origin Agent Bootstrap Context"];
  const includedSections: string[] = ["system-prompt", "runtime-instruction"];
  const omittedSections: string[] = [];

  if (state.includeIntro) {
    sections.push(
      "",
      "This bundle is meant to be pasted into an AI model context so the model can learn how to speak and read Origin immediately.",
      "",
      "Use the included system prompt as the behavioral contract and the drill set as the target behavior reference.",
    );
    includedSections.push("intro");
  } else {
    omittedSections.push("intro");
  }

  sections.push("", "## System Prompt", "", stripLeadingTitle(readMarkdown(SYSTEM_PROMPT_PATH)));

  if (state.includeQuickstart) {
    sections.push("", "## Quickstart", "", stripLeadingTitle(readMarkdown(QUICKSTART_PATH)));
    includedSections.push("quickstart");
  } else {
    omittedSections.push("quickstart");
  }

  if (state.includePlaybook) {
    sections.push("", "## Playbook", "", stripLeadingTitle(readMarkdown(PLAYBOOK_PATH)));
    includedSections.push("playbook");
  } else {
    omittedSections.push("playbook");
  }

  if (state.includeDrills && state.includedDrillCount > 0) {
    sections.push("", "## Drills", "", buildDrillSection(availableDrills, state.includedDrillCount));
    includedSections.push("drills");
  } else if (state.includeDrills) {
    omittedSections.push("all-drills");
  }

  if (!state.includeDrills) {
    omittedSections.push("drills");
  } else if (
    state.includedDrillCount > 0 &&
    state.includedDrillCount < availableDrills.length
  ) {
    omittedSections.push(`trimmed-drills:${availableDrills.length - state.includedDrillCount}`);
  }

  sections.push(
    "",
    "## Runtime Instruction",
    "",
    "When asked for Origin output, prefer valid Origin packets or frames over prose. If the user supplies controlled English, compile it into Origin deterministically. Use `FW1` as the default internal transport for multi-packet workflows. If explanation is requested, explain outside the packet.",
  );

  const content = sections.join("\n");
  const estimatedTokens = estimateModelTokens(content);

  return {
    content,
    estimatedTokens,
    tokenBudget,
    includedSections,
    omittedSections,
    includedDrillCount: state.includeDrills ? state.includedDrillCount : 0,
    budgetSatisfied: tokenBudget ? estimatedTokens <= tokenBudget : true,
  };
}

function extractDrillBlocks(content: string): string[] {
  const segments = content.split(/\n(?=## Drill \d+:)/);
  return segments.slice(1);
}

function buildDrillSection(drills: string[], drillLimit: number): string {
  const header = "Use these drills to train or evaluate an AI agent on Origin.\n";
  return `${header}\n${drills.slice(0, drillLimit).join("\n")}`.trim();
}
