export type ObservationCorrectionFeedback = {
  submissionId: string;
  targetId: string;
  disposition: 'defer';
  ok: boolean;
  error: string | null;
};

export type ObservationCorrectionFeedbackState = {
  active: {
    submissionId: string;
    targetId: string;
    disposition: 'defer';
  } | null;
  result: ObservationCorrectionFeedback | null;
};

export type ObservationCorrectionFeedbackAction =
  | {
      type: 'submit';
      submissionId: string;
      targetId: string;
      disposition: 'defer';
    }
  | {
      type: 'settle';
      submissionId: string;
      targetId: string;
      disposition: 'defer';
      ok: boolean;
      error?: string | null;
    }
  | { type: 'clear' };

export const initialObservationCorrectionFeedback: ObservationCorrectionFeedbackState = {
  active: null,
  result: null,
};

export function observationCorrectionFeedbackReducer(
  state: ObservationCorrectionFeedbackState,
  action: ObservationCorrectionFeedbackAction,
): ObservationCorrectionFeedbackState {
  if (action.type === 'clear') return initialObservationCorrectionFeedback;
  if (action.type === 'submit') {
    return {
      active: {
        submissionId: action.submissionId,
        targetId: action.targetId,
        disposition: action.disposition,
      },
      result: null,
    };
  }
  if (
    !state.active
    || state.active.submissionId !== action.submissionId
    || state.active.targetId !== action.targetId
    || state.active.disposition !== action.disposition
  ) {
    return state;
  }
  return {
    active: null,
    result: {
      submissionId: action.submissionId,
      targetId: action.targetId,
      disposition: action.disposition,
      ok: action.ok,
      error: action.error ?? null,
    },
  };
}

export function observationCorrectionFeedbackForTarget(
  state: ObservationCorrectionFeedbackState,
  targetId: string,
) {
  return state.result?.targetId === targetId ? state.result : null;
}
