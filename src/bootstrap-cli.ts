import { buildAgentBootstrapBundle } from "./bootstrap.js";

const args = process.argv.slice(2);

const options = {
  includeQuickstart: !args.includes("--no-quickstart"),
  includePlaybook: !args.includes("--no-playbook"),
  includeDrills: !args.includes("--no-drills"),
  drillLimit: parseNumberFlag(args, "--drills"),
  tokenBudget: parseNumberFlag(args, "--token-budget"),
  outputPath: parseStringFlag(args, "--out"),
};

const result = buildAgentBootstrapBundle(options);

console.log(result.content);

console.error("");
console.error(
  `Bootstrap meta: estimatedTokens=${result.estimatedTokens}, includedDrills=${result.includedDrillCount}, budgetSatisfied=${result.budgetSatisfied}`,
);
console.error(`Included sections: ${result.includedSections.join(", ")}`);

if (result.omittedSections.length > 0) {
  console.error(`Omitted sections: ${result.omittedSections.join(", ")}`);
}

if (options.outputPath) {
  console.error(`\nSaved bootstrap context to ${options.outputPath}`);
}

function parseNumberFlag(args: string[], flag: string): number | undefined {
  const index = args.indexOf(flag);

  if (index < 0 || index === args.length - 1) {
    return undefined;
  }

  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? value : undefined;
}

function parseStringFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index < 0 || index === args.length - 1) {
    return undefined;
  }

  return args[index + 1];
}
