export type CustomerRoutineInput = {
  name: string;
  stepSourceFormat?: CustomerRoutineStepSourceFormat;
  steps: readonly {
    sourceStepId?: string;
    label: string;
    instruction: string;
  }[];
};

export type CustomerRoutineStepSourceFormat = 'legacy' | 'structured';

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/gu;
const SOURCE_STEP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SERIALIZED_STEPS_LENGTH = 16_384;
const STEP_KEYS = new Set(['sourceStepId', 'label', 'instruction']);

export type CustomerRoutineStepReferenceState =
  | 'none'
  | 'catalogue'
  | 'product_request'
  | 'unresolved';

export type CustomerRoutineAuthoritativeStepReference = {
  sourceStepId: string;
  referenceState: CustomerRoutineStepReferenceState;
  productIdentityVersionId: string | null;
  productRequestId: string | null;
};

export type CustomerRoutineStepWrite = CustomerRoutineInput['steps'][number] & {
  referenceState: CustomerRoutineStepReferenceState;
  productIdentityVersionId: string | null;
  productRequestId: string | null;
};

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

function normalizedInstruction(value: unknown) {
  if (typeof value !== 'string') throw new Error('Routine details are invalid.');
  if (!value.trim()) return '';
  return normalizedText(value, 400);
}

function normalizedSourceStepId(value: unknown) {
  if (typeof value !== 'string' || value !== value.trim() || !SOURCE_STEP_ID.test(value)) {
    throw new Error('Routine step source is invalid.');
  }
  return value.toLowerCase();
}

function parseStructuredSteps(value: string): CustomerRoutineInput['steps'] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Routine steps are invalid.');
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) {
    throw new Error('A routine needs between 1 and 20 steps.');
  }

  const sourceStepIds = new Set<string>();
  return parsed.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Routine steps are invalid.');
    }
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some(key => !STEP_KEYS.has(key))) {
      throw new Error('Routine steps are invalid.');
    }
    const sourceStepId = record.sourceStepId === undefined
      ? undefined
      : normalizedSourceStepId(record.sourceStepId);
    if (sourceStepId && sourceStepIds.has(sourceStepId)) {
      throw new Error('Routine step sources must be unique.');
    }
    if (sourceStepId) sourceStepIds.add(sourceStepId);
    return {
      ...(sourceStepId ? { sourceStepId } : {}),
      label: normalizedText(record.label, 160),
      instruction: normalizedInstruction(record.instruction ?? ''),
    };
  });
}

function parseLegacySteps(value: string): CustomerRoutineInput['steps'] {
  const lines = value
    .normalize('NFKC')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length < 1 || lines.length > 20) {
    throw new Error('A routine needs between 1 and 20 steps.');
  }
  return lines.map(line => {
    const separator = line.indexOf('|');
    const label = normalizedText(separator === -1 ? line : line.slice(0, separator), 160);
    const rawInstruction = separator === -1 ? '' : line.slice(separator + 1);
    return { label, instruction: normalizedInstruction(rawInstruction) };
  });
}

export function parseCustomerRoutineInput(
  name: unknown,
  serializedSteps: unknown,
): CustomerRoutineInput {
  if (
    typeof serializedSteps !== 'string'
    || serializedSteps.length > MAX_SERIALIZED_STEPS_LENGTH
  ) {
    throw new Error('Routine steps are invalid.');
  }
  const value = serializedSteps.trim();
  const steps = value.startsWith('[')
    ? parseStructuredSteps(value)
    : parseLegacySteps(value);
  return {
    name: normalizedText(name, 80),
    stepSourceFormat: value.startsWith('[') ? 'structured' : 'legacy',
    steps,
  };
}

export function serializeCustomerRoutineSteps(steps: CustomerRoutineInput['steps']) {
  return JSON.stringify(steps.map(step => ({
    ...(step.sourceStepId ? { sourceStepId: step.sourceStepId } : {}),
    label: step.label,
    instruction: step.instruction,
  })));
}

/**
 * Bind submitted source step IDs to references read from the exact owner and
 * routine inside the repository transaction. Reference IDs never come from the
 * client; a missing source means the submitted step is new and unreferenced.
 */
export function bindCustomerRoutineStepReferences(
  steps: CustomerRoutineInput['steps'],
  authoritativeReferences: readonly CustomerRoutineAuthoritativeStepReference[],
  sourceFormat: CustomerRoutineStepSourceFormat = 'structured',
): CustomerRoutineStepWrite[] | null {
  const hasStoredReference = authoritativeReferences.some(
    reference => reference.referenceState !== 'none',
  );
  // A pre-deployment editor cannot identify existing steps. Never let its
  // legacy line payload silently erase authoritative references. Structured
  // input can intentionally replace every referenced step with plain steps.
  if (sourceFormat === 'legacy' && hasStoredReference) return null;

  const referencesBySource = new Map<string, CustomerRoutineAuthoritativeStepReference>();
  for (const reference of authoritativeReferences) {
    if (referencesBySource.has(reference.sourceStepId)) {
      throw new Error('Routine step references are invalid.');
    }
    referencesBySource.set(reference.sourceStepId, reference);
  }

  const writes: CustomerRoutineStepWrite[] = [];
  for (const step of steps) {
    if (!step.sourceStepId) {
      writes.push({
        label: step.label,
        instruction: step.instruction,
        referenceState: 'none',
        productIdentityVersionId: null,
        productRequestId: null,
      });
      continue;
    }
    const reference = referencesBySource.get(step.sourceStepId);
    if (!reference) return null;
    writes.push({
      sourceStepId: step.sourceStepId,
      label: step.label,
      instruction: step.instruction,
      referenceState: reference.referenceState,
      productIdentityVersionId: reference.productIdentityVersionId,
      productRequestId: reference.productRequestId,
    });
  }
  return writes;
}
