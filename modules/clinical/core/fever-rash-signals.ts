const negatedFever = /\b(?:no|without|not having|do not have|don't have|does not have|doesn't have)\s+(?:a\s+)?(?:fever|high temperature)\b/;
const negatedRash = /\b(?:no|without|not having|do not have|don't have|does not have|doesn't have)\s+(?:a\s+)?(?:rash|spots?|blotches?)\b|\b(?:rash|spots?|blotches?)\s+(?:has|have)\s+not\s+appeared\b/;
const negatedStiffNeck = /\b(?:no|without|not having|do not have|don't have|does not have|doesn't have)\s+(?:a\s+)?(?:stiff neck|neck stiffness)\b/;
const negatedAlertnessChange = /\b(?:no|without|not having|do not have|don't have|does not have|doesn't have)\s+(?:any\s+)?(?:confusion|seizures?|fits?|difficulty waking|difficulty staying awake|trouble staying awake)\b/;
const conversationalConfusion = /\bconfused\s+(?:about|by|over)\s+(?:(?:an?|the|my|this|that|some)\s+)?(?:[a-z-]+\s+){0,3}(?:rash|spots?|skin|symptoms?|diagnosis|question|answer|instructions?|product|cream|clinic|appointment|care|treatment|steps?)\b/;

function diagnosisWasRuledOut(text: string, diagnosis: RegExp) {
  const source = diagnosis.source;
  const unresolved = new RegExp(
    String.raw`\b(?:cannot|can't|could not|couldn't|did not|didn't|does not|doesn't|unable to)\s+rule\s+out\s+(?:a\s+diagnosis\s+of\s+)?${source}|\b${source}\s+(?:was|has|is)\s+not\s+(?:been\s+)?ruled\s+out\b`,
  );
  if (unresolved.test(text)) return false;

  return (
    new RegExp(String.raw`\bruled\s+out\s+(?:a\s+diagnosis\s+of\s+)?${source}`).test(text)
    || new RegExp(String.raw`\b${source}\s+(?:was|has been|is)\s+ruled\s+out\b`).test(text)
    || new RegExp(String.raw`\b(?:tested|test)\s+negative\s+for\s+${source}`).test(text)
    || new RegExp(String.raw`\b(?:no|not|do not have|don't have|does not have|doesn't have)\s+${source}`).test(text)
  );
}

export function hasAffirmedNamedDiagnosis(text: string, diagnosis: RegExp) {
  return diagnosis.test(text) && !diagnosisWasRuledOut(text, diagnosis);
}

export function hasAffirmedFever(text: string) {
  return /\b(?:fever|high temperature)\b/.test(text) && !negatedFever.test(text);
}

export function hasCurrentRash(text: string) {
  return /\b(?:rash|spots?|blotches?)\b/.test(text) && !negatedRash.test(text);
}

export function hasAffirmedStiffNeck(text: string) {
  return /\b(?:stiff neck|neck stiffness)\b/.test(text) && !negatedStiffNeck.test(text);
}

export function hasAffirmedAlertnessOrSeizureWarning(text: string) {
  const warning = /\b(?:confusion|confused|seizure|first fit|difficult to wake|hard to wake|cannot wake|can't wake|unable to stay awake|cannot stay awake|can't stay awake|hard to stay awake|difficult to stay awake)\b/.test(text);
  return warning && !negatedAlertnessChange.test(text) && !conversationalConfusion.test(text);
}

export function hasAffirmedInfantMeningitisWarning(text: string) {
  return /\b(?:bulging soft spot|bulging fontanelle|floppy baby|baby is floppy)\b/.test(text)
    && !/\b(?:no|without)\s+(?:a\s+)?(?:bulging soft spot|bulging fontanelle|floppy baby)\b/.test(text);
}

export function hasNonFadingRash(text: string) {
  const rash = String.raw`(?:rash|spots?|blotches?)`;
  const doesNotChange = String.raw`(?:(?:does|do|will)\s+not|doesn't|don't|won't)\s+(?:fade|disappear)`;
  const pressure = String.raw`(?:when|if)\s+(?:i\s+)?press(?:ed|ing)?(?:\s+(?:a|the)\s+(?:clear\s+)?glass)?(?:\s+(?:on|against)\s+(?:it|them|the skin))?|under\s+(?:a\s+)?(?:clear\s+)?glass|with\s+pressure`;

  return (
    new RegExp(String.raw`\b${rash}\b.{0,80}\b${doesNotChange}\b.{0,64}\b${pressure}\b`).test(text)
    || new RegExp(String.raw`\b${pressure}\b.{0,64}\b${rash}\b.{0,80}\b${doesNotChange}\b`).test(text)
    || new RegExp(String.raw`\b(?:purple|dark red)\s+${rash}\b.{0,80}\b${doesNotChange}\b`).test(text)
    || /\bnon[- ]blanching\s+(?:rash|spots?|blotches?)\b/.test(text)
  );
}
