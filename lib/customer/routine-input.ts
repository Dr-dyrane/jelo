export type CustomerRoutineInput = {
  name: string;
  steps: readonly {
    label: string;
    instruction: string;
  }[];
};

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/gu;

function normalizedText(value: unknown, maximumLength: number) {
  if (typeof value !== 'string') throw new Error('Routine details are invalid.');
  const normalized = value
    .normalize('NFKC')
    .replace(CONTROL_OR_FORMAT, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new Error('Routine details are invalid.');
  }
  return normalized;
}

export function parseCustomerRoutineInput(
  name: unknown,
  stepLines: unknown,
): CustomerRoutineInput {
  if (typeof stepLines !== 'string') throw new Error('Routine steps are invalid.');
  const lines = stepLines
    .normalize('NFKC')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length < 1 || lines.length > 20) {
    throw new Error('A routine needs between 1 and 20 steps.');
  }
  const steps = lines.map(line => {
    const separator = line.indexOf('|');
    const label = normalizedText(separator === -1 ? line : line.slice(0, separator), 160);
    const rawInstruction = separator === -1 ? '' : line.slice(separator + 1);
    const instruction = rawInstruction.trim()
      ? normalizedText(rawInstruction, 400)
      : '';
    return { label, instruction };
  });
  return { name: normalizedText(name, 80), steps };
}

export function serializeCustomerRoutineSteps(steps: CustomerRoutineInput['steps']) {
  return steps
    .map(step => step.instruction ? `${step.label} | ${step.instruction}` : step.label)
    .join('\n');
}
