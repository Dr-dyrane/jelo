export const CONSULT_AI_RETENTION_DEFAULT_LIMIT = 100;
export const CONSULT_AI_RETENTION_MIN_LIMIT = 1;
export const CONSULT_AI_RETENTION_MAX_LIMIT = 500;
export const CONSULT_AI_RETENTION_CONFIRMATION =
  "purge-expired-consult-ai-generations";

export type ConsultAiRetentionOptions = {
  apply: boolean;
  limit: number;
};

export type ConsultAiRetentionAggregate = {
  eligible: number;
  selected: number;
  deleted: number;
  remaining: number;
};

export type ConsultAiRetentionResult = ConsultAiRetentionAggregate & {
  mode: "dry-run" | "applied";
};

export type ConsultAiRetentionDependencies = {
  countEligible: () => Promise<number>;
  applyBatch: (limit: number) => Promise<ConsultAiRetentionAggregate>;
};

type RetentionEnvironment = {
  VERCEL?: string;
  VERCEL_ENV?: string;
  [key: string]: string | undefined;
};

function requireSingleOption(
  seen: Set<string>,
  option: "--apply" | "--limit" | "--confirm",
) {
  if (seen.has(option)) {
    throw new Error(`${option} may be provided only once.`);
  }
  seen.add(option);
}

function optionValue(
  argv: readonly string[],
  index: number,
  option: "--limit" | "--confirm",
) {
  const argument = argv[index];
  const prefix = `${option}=`;
  if (argument.startsWith(prefix)) {
    const value = argument.slice(prefix.length);
    if (!value) throw new Error(`${option} requires a value.`);
    return { value, consumed: 0 };
  }
  if (argument === option) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${option} requires a value.`);
    }
    return { value, consumed: 1 };
  }
  return undefined;
}

function parseLimit(value: string) {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error("--limit must be a base-10 positive integer.");
  }
  const limit = Number(value);
  if (
    !Number.isSafeInteger(limit) ||
    limit < CONSULT_AI_RETENTION_MIN_LIMIT ||
    limit > CONSULT_AI_RETENTION_MAX_LIMIT
  ) {
    throw new Error(
      `--limit must be between ${CONSULT_AI_RETENTION_MIN_LIMIT} and ${CONSULT_AI_RETENTION_MAX_LIMIT}.`,
    );
  }
  return limit;
}

export function parseConsultAiRetentionOptions(
  argv: readonly string[],
): ConsultAiRetentionOptions {
  let apply = false;
  let limit = CONSULT_AI_RETENTION_DEFAULT_LIMIT;
  let confirmation: string | undefined;
  const seen = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      requireSingleOption(seen, "--apply");
      apply = true;
      continue;
    }

    const limitOption = optionValue(argv, index, "--limit");
    if (limitOption) {
      requireSingleOption(seen, "--limit");
      limit = parseLimit(limitOption.value);
      index += limitOption.consumed;
      continue;
    }

    const confirmationOption = optionValue(argv, index, "--confirm");
    if (confirmationOption) {
      requireSingleOption(seen, "--confirm");
      confirmation = confirmationOption.value;
      index += confirmationOption.consumed;
      continue;
    }

    throw new Error(`Unsupported Ask Jelo retention option ${argument}.`);
  }

  if (!apply && confirmation !== undefined) {
    throw new Error("--confirm is accepted only with --apply.");
  }
  if (apply && confirmation !== CONSULT_AI_RETENTION_CONFIRMATION) {
    throw new Error(
      `Apply requires --confirm=${CONSULT_AI_RETENTION_CONFIRMATION}.`,
    );
  }

  return { apply, limit };
}

export function assertConsultAiRetentionOperatorEnvironment(
  environment: RetentionEnvironment,
) {
  if (environment.VERCEL || environment.VERCEL_ENV) {
    throw new Error(
      "Ask Jelo retention is unavailable in every Vercel environment.",
    );
  }
}

export async function executeConsultAiRetentionOperator(
  options: ConsultAiRetentionOptions,
  dependencies: ConsultAiRetentionDependencies,
): Promise<ConsultAiRetentionResult> {
  if (!options.apply) {
    const eligible = await dependencies.countEligible();
    return {
      mode: "dry-run",
      eligible,
      selected: Math.min(eligible, options.limit),
      deleted: 0,
      remaining: eligible,
    };
  }

  const result = await dependencies.applyBatch(options.limit);
  return {
    mode: "applied",
    eligible: result.eligible,
    selected: result.selected,
    deleted: result.deleted,
    remaining: result.remaining,
  };
}
