import ts from "typescript";

const ALLOWED_OPTION_FIELDS = new Set([
  "available",
  "stock",
  "observedAt",
  "expiresAt",
  "verificationMethod",
]);
const ALLOWED_STOCK = new Set([
  "in-stock",
  "low-stock",
  "out-of-stock",
  "unknown",
]);
const MAX_PRICE_CHANGE_RATIO = 0.35;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_FRESHNESS_DAYS = {
  retailer_page: 5,
  api: 7,
} as const;

type ParsedOffer = {
  key: string;
  slug: string;
  retailer: string;
  call: ts.CallExpression;
  callText: string;
  argumentTexts: string[];
  priceNgn: number;
  options: Map<string, { text: string; expression: ts.Expression }>;
  optionsNode?: ts.ObjectLiteralExpression;
};

type ParsedOffersFile = {
  content: string;
  source: ts.SourceFile;
  checkedAt: string;
  initializer: ts.ObjectLiteralExpression;
  initializerStart: number;
  initializerEnd: number;
  offers: ParsedOffer[];
  offerByKey: Map<string, ParsedOffer>;
  maskedInitializer: string;
};

export type StaticSyncProposalValidation = {
  changedOffers: number;
  refreshedOffers: number;
  invalidatedOffers: number;
  offerKeys: string[];
};

export class StaticSyncProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaticSyncProposalValidationError";
  }
}

function fail(message: string): never {
  throw new StaticSyncProposalValidationError(message);
}

function parseSource(content: string, label: string) {
  const source = ts.createSourceFile(
    `${label}.ts`,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics = (
    source as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] }
  ).parseDiagnostics;
  if (diagnostics?.length) {
    fail(`${label} retail-offers.ts is not valid TypeScript`);
  }
  return source;
}

function variableInitializer(
  source: ts.SourceFile,
  name: string,
): ts.Expression {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer
      ) {
        return declaration.initializer;
      }
    }
  }
  return fail(`Missing ${name} initializer`);
}

function stringLiteral(expression: ts.Expression, context: string): string {
  if (!ts.isStringLiteral(expression)) {
    fail(`${context} must be a string literal`);
  }
  return expression.text;
}

function positiveNumber(expression: ts.Expression, context: string): number {
  if (!ts.isNumericLiteral(expression)) {
    fail(`${context} must be a numeric literal`);
  }
  const value = Number(expression.text);
  if (!Number.isFinite(value) || value <= 0) {
    fail(`${context} must be a positive finite number`);
  }
  return value;
}

function propertyName(name: ts.PropertyName, context: string): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return fail(`${context} must use a static property name`);
}

function parseOptions(
  expression: ts.Expression | undefined,
  source: ts.SourceFile,
  context: string,
) {
  const options = new Map<
    string,
    { text: string; expression: ts.Expression }
  >();
  if (!expression) return options;
  if (!ts.isObjectLiteralExpression(expression)) {
    fail(`${context} options must be an object literal`);
  }
  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property)) {
      fail(`${context} options may only contain property assignments`);
    }
    const name = propertyName(property.name, `${context} option`);
    if (options.has(name)) fail(`${context} has duplicate option ${name}`);
    options.set(name, {
      text: property.initializer.getText(source),
      expression: property.initializer,
    });
  }
  return options;
}

function parseOffersFile(content: string, label: string): ParsedOffersFile {
  const source = parseSource(content, label);
  const checkedAt = stringLiteral(
    variableInitializer(source, "checkedAt"),
    `${label} checkedAt`,
  );
  if (!Number.isFinite(new Date(checkedAt).valueOf())) {
    fail(`${label} checkedAt is invalid`);
  }

  const initializer = variableInitializer(source, "verifiedRetailOffers");
  if (!ts.isObjectLiteralExpression(initializer)) {
    fail(`${label} verifiedRetailOffers must be an object literal`);
  }

  const offers: ParsedOffer[] = [];
  const offerByKey = new Map<string, ParsedOffer>();
  const slugs = new Set<string>();
  const retailerOccurrences = new Map<string, number>();

  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) {
      fail(
        `${label} verifiedRetailOffers may only contain product assignments`,
      );
    }
    const slug = propertyName(property.name, `${label} product`);
    if (slugs.has(slug)) fail(`${label} has duplicate product ${slug}`);
    slugs.add(slug);
    if (!ts.isArrayLiteralExpression(property.initializer)) {
      fail(`${label} product ${slug} must contain an offer array`);
    }

    for (const element of property.initializer.elements) {
      if (
        !ts.isCallExpression(element) ||
        !ts.isIdentifier(element.expression) ||
        element.expression.text !== "exactNg"
      )
        continue;
      if (element.arguments.length < 6 || element.arguments.length > 7) {
        fail(`${label} product ${slug} has an unsupported exactNg shape`);
      }
      const retailer = stringLiteral(
        element.arguments[0],
        `${label} ${slug} retailer`,
      );
      const retailerKey = `${slug} :: ${retailer}`;
      const occurrence = (retailerOccurrences.get(retailerKey) ?? 0) + 1;
      retailerOccurrences.set(retailerKey, occurrence);
      const key = `${retailerKey} #${occurrence}`;
      const offer: ParsedOffer = {
        key,
        slug,
        retailer,
        call: element,
        callText: content.slice(element.getStart(source), element.end),
        argumentTexts: element.arguments.map((argument) =>
          argument.getText(source),
        ),
        priceNgn: positiveNumber(element.arguments[3], `${label} ${key} price`),
        options: parseOptions(element.arguments[6], source, `${label} ${key}`),
        optionsNode:
          element.arguments[6] &&
          ts.isObjectLiteralExpression(element.arguments[6])
            ? element.arguments[6]
            : undefined,
      };
      offers.push(offer);
      offerByKey.set(key, offer);
    }
  }

  const initializerStart = initializer.getStart(source);
  const initializerEnd = initializer.end;
  let maskedInitializer = content.slice(initializerStart, initializerEnd);
  for (const offer of [...offers].reverse()) {
    const start = offer.call.getStart(source) - initializerStart;
    const end = offer.call.end - initializerStart;
    maskedInitializer =
      maskedInitializer.slice(0, start) +
      `exactNg(/* ${offer.key} */)` +
      maskedInitializer.slice(end);
  }

  return {
    content,
    source,
    checkedAt,
    initializer,
    initializerStart,
    initializerEnd,
    offers,
    offerByKey,
    maskedInitializer,
  };
}

function optionString(offer: ParsedOffer, name: string): string | undefined {
  const option = offer.options.get(name);
  return option
    ? stringLiteral(option.expression, `${offer.key} ${name}`)
    : undefined;
}

function optionBoolean(offer: ParsedOffer, name: string): boolean | undefined {
  const option = offer.options.get(name);
  if (!option) return undefined;
  if (option.expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (option.expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  return fail(`${offer.key} ${name} must be a boolean literal`);
}

function timestamp(value: string | undefined, context: string): number {
  if (!value) fail(`${context} is required`);
  const parsed = new Date(value).valueOf();
  if (!Number.isFinite(parsed)) fail(`${context} is invalid`);
  return parsed;
}

function assertSameOutsideInitializer(
  baseContent: string,
  candidateContent: string,
  base: ParsedOffersFile,
  candidate: ParsedOffersFile,
) {
  const basePrefix = baseContent.slice(0, base.initializerStart);
  const candidatePrefix = candidateContent.slice(0, candidate.initializerStart);
  const baseSuffix = baseContent.slice(base.initializerEnd);
  const candidateSuffix = candidateContent.slice(candidate.initializerEnd);
  if (basePrefix !== candidatePrefix || baseSuffix !== candidateSuffix) {
    fail("The proposal changes content outside verifiedRetailOffers");
  }
  if (base.maskedInitializer !== candidate.maskedInitializer) {
    fail(
      "The proposal changes product structure or text outside exactNg calls",
    );
  }
}

function assertSameOfferIdentity(base: ParsedOffer, candidate: ParsedOffer) {
  if (
    base.argumentTexts.length !== candidate.argumentTexts.length &&
    !(base.argumentTexts.length === 6 && candidate.argumentTexts.length === 7)
  ) {
    fail(`${base.key} changes the exactNg argument shape`);
  }
  for (const index of [0, 1, 2, 4, 5]) {
    if (base.argumentTexts[index] !== candidate.argumentTexts[index]) {
      fail(`${base.key} changes protected exactNg argument ${index + 1}`);
    }
  }

  const protectedBase = [...base.options.entries()].filter(
    ([name]) => !ALLOWED_OPTION_FIELDS.has(name),
  );
  const protectedCandidate = [...candidate.options.entries()].filter(
    ([name]) => !ALLOWED_OPTION_FIELDS.has(name),
  );
  if (protectedBase.length !== protectedCandidate.length) {
    fail(`${base.key} changes protected options`);
  }
  for (let index = 0; index < protectedBase.length; index++) {
    const [baseName, baseValue] = protectedBase[index];
    const [candidateName, candidateValue] = protectedCandidate[index];
    if (baseName !== candidateName || baseValue.text !== candidateValue.text) {
      fail(`${base.key} changes protected option ${baseName}`);
    }
  }
}

function assertAllowedCandidateValues(candidate: ParsedOffer) {
  const stock = optionString(candidate, "stock");
  if (stock !== undefined && !ALLOWED_STOCK.has(stock)) {
    fail(`${candidate.key} has invalid stock ${stock}`);
  }
  optionBoolean(candidate, "available");
  const method = optionString(candidate, "verificationMethod");
  if (
    method !== undefined &&
    method !== "manual" &&
    method !== "retailer_page" &&
    method !== "api"
  ) {
    fail(`${candidate.key} has invalid verificationMethod ${method}`);
  }
  const observedAt = optionString(candidate, "observedAt");
  if (observedAt !== undefined)
    timestamp(observedAt, `${candidate.key} observedAt`);
  const expiresAt = optionString(candidate, "expiresAt");
  if (expiresAt !== undefined)
    timestamp(expiresAt, `${candidate.key} expiresAt`);
}

function classifyChangedOffer(
  baseFile: ParsedOffersFile,
  base: ParsedOffer,
  candidate: ParsedOffer,
): "refresh" | "invalidation" {
  assertSameOfferIdentity(base, candidate);
  assertAllowedCandidateValues(candidate);

  const baseObservedText =
    optionString(base, "observedAt") ?? baseFile.checkedAt;
  const candidateObservedText =
    optionString(candidate, "observedAt") ?? baseFile.checkedAt;
  const baseObserved = timestamp(
    baseObservedText,
    `${base.key} base observedAt`,
  );
  const candidateObserved = timestamp(
    candidateObservedText,
    `${candidate.key} candidate observedAt`,
  );

  if (candidateObserved > baseObserved) {
    if (optionString(base, "verificationMethod") === "manual") {
      fail(`${base.key} is manually verified and cannot be auto-refreshed`);
    }
    const method = optionString(candidate, "verificationMethod");
    if (method !== "retailer_page" && method !== "api") {
      fail(`${candidate.key} refresh requires retailer_page or api evidence`);
    }
    if (
      optionBoolean(candidate, "available") === undefined ||
      optionString(candidate, "stock") === undefined
    ) {
      fail(`${candidate.key} refresh requires explicit availability and stock`);
    }
    const expiresAt = timestamp(
      optionString(candidate, "expiresAt"),
      `${candidate.key} expiresAt`,
    );
    const maximumExpiry =
      candidateObserved + MAX_FRESHNESS_DAYS[method] * MS_PER_DAY;
    if (expiresAt <= candidateObserved || expiresAt > maximumExpiry) {
      fail(`${candidate.key} refresh exceeds its bounded verification window`);
    }
    const priceChange =
      Math.abs(candidate.priceNgn - base.priceNgn) / base.priceNgn;
    if (priceChange > MAX_PRICE_CHANGE_RATIO) {
      fail(`${candidate.key} price change exceeds 35%`);
    }
    return "refresh";
  }

  if (candidateObserved < baseObserved) {
    fail(`${candidate.key} moves observedAt backwards`);
  }
  if (candidate.priceNgn !== base.priceNgn) {
    fail(`${candidate.key} terminal invalidation changes price`);
  }
  if (
    base.options.get("observedAt")?.text !==
      candidate.options.get("observedAt")?.text ||
    base.options.get("verificationMethod")?.text !==
      candidate.options.get("verificationMethod")?.text
  ) {
    fail(`${candidate.key} terminal invalidation changes provenance`);
  }
  if (
    optionBoolean(candidate, "available") !== false ||
    optionString(candidate, "stock") !== "unknown"
  ) {
    fail(`${candidate.key} terminal invalidation must fail closed`);
  }
  const candidateExpiry = timestamp(
    optionString(candidate, "expiresAt"),
    `${candidate.key} expiresAt`,
  );
  const baseExpiryText = optionString(base, "expiresAt");
  if (candidateExpiry <= baseObserved) {
    fail(`${candidate.key} terminal expiry must follow its observation`);
  }
  if (
    baseExpiryText &&
    candidateExpiry > timestamp(baseExpiryText, `${base.key} base expiresAt`)
  ) {
    fail(`${candidate.key} terminal invalidation extends freshness`);
  }
  return "invalidation";
}

export function validateStaticSyncProposal(input: {
  baseContent: string;
  candidateContent: string;
}): StaticSyncProposalValidation {
  const base = parseOffersFile(input.baseContent, "base");
  const candidate = parseOffersFile(input.candidateContent, "candidate");
  assertSameOutsideInitializer(
    input.baseContent,
    input.candidateContent,
    base,
    candidate,
  );

  const baseKeys = base.offers.map((offer) => offer.key);
  const candidateKeys = candidate.offers.map((offer) => offer.key);
  if (
    baseKeys.length !== candidateKeys.length ||
    baseKeys.some((key, index) => key !== candidateKeys[index])
  ) {
    fail("The proposal adds, removes, or reorders an exact offer");
  }

  let refreshedOffers = 0;
  let invalidatedOffers = 0;
  const offerKeys: string[] = [];
  for (const baseOffer of base.offers) {
    const candidateOffer = candidate.offerByKey.get(baseOffer.key);
    if (!candidateOffer) fail(`Missing candidate offer ${baseOffer.key}`);
    if (baseOffer.callText === candidateOffer.callText) continue;
    const classification = classifyChangedOffer(
      base,
      baseOffer,
      candidateOffer,
    );
    if (classification === "refresh") refreshedOffers++;
    else invalidatedOffers++;
    offerKeys.push(baseOffer.key);
  }

  if (offerKeys.length === 0) {
    fail("The proposal contains no static offer changes");
  }
  return {
    changedOffers: offerKeys.length,
    refreshedOffers,
    invalidatedOffers,
    offerKeys,
  };
}

export type StaticSyncProposalMerge = {
  content: string;
  proposalChanges: number;
  applied: number;
  alreadyApplied: number;
  staleSkipped: number;
  removedSkipped: number;
};

function coreIdentity(offer: ParsedOffer) {
  return JSON.stringify([
    stringLiteral(offer.call.arguments[0], `${offer.key} retailer`),
    stringLiteral(offer.call.arguments[1], `${offer.key} URL`),
    positiveNumber(offer.call.arguments[2], `${offer.key} trust`),
    stringLiteral(offer.call.arguments[4], `${offer.key} variant`),
    stringLiteral(offer.call.arguments[5], `${offer.key} size`),
  ]);
}

function observedTimestamp(file: ParsedOffersFile, offer: ParsedOffer) {
  return timestamp(
    optionString(offer, "observedAt") ?? file.checkedAt,
    `${offer.key} observedAt`,
  );
}

function optionText(offer: ParsedOffer, name: string) {
  return offer.options.get(name)?.text;
}

type TextEdit = { start: number; end: number; text: string };

function lineIndent(source: ts.SourceFile, position: number) {
  const lineStart = source.getPositionOfLineAndCharacter(
    source.getLineAndCharacterOfPosition(position).line,
    0,
  );
  return source.text.slice(lineStart, position).match(/^\s*/)?.[0] ?? "";
}

function rewriteOfferCall(input: {
  file: ParsedOffersFile;
  offer: ParsedOffer;
  priceNgn?: number;
  options: Map<string, string>;
}) {
  const { file, offer } = input;
  const callStart = offer.call.getStart(file.source);
  const edits: TextEdit[] = [];
  if (input.priceNgn !== undefined && input.priceNgn !== offer.priceNgn) {
    const price = offer.call.arguments[3];
    edits.push({
      start: price.getStart(file.source) - callStart,
      end: price.end - callStart,
      text: String(input.priceNgn),
    });
  }

  const missing: Array<[string, string]> = [];
  for (const [name, value] of input.options) {
    const current = offer.options.get(name);
    if (!current) {
      missing.push([name, value]);
      continue;
    }
    if (current.text === value) continue;
    edits.push({
      start: current.expression.getStart(file.source) - callStart,
      end: current.expression.end - callStart,
      text: value,
    });
  }

  if (missing.length > 0) {
    const fields = missing.map(([name, value]) => `${name}: ${value},`);
    const optionsNode = offer.optionsNode;
    if (!optionsNode) {
      const closingParen = offer.call.end - callStart - 1;
      const separator = offer.call.arguments.hasTrailingComma ? "" : ",";
      edits.push({
        start: closingParen,
        end: closingParen,
        text: `${separator}\n      {\n        ${fields.join("\n        ")}\n      }`,
      });
    } else if (optionsNode.properties.length === 0) {
      const closingBrace = optionsNode.end - callStart - 1;
      const closingIndent = lineIndent(
        file.source,
        optionsNode.getStart(file.source),
      );
      edits.push({
        start: closingBrace,
        end: closingBrace,
        text: `\n${closingIndent}  ${fields.join(`\n${closingIndent}  `)}\n${closingIndent}`,
      });
    } else {
      const lastProperty = optionsNode.properties.at(-1)!;
      const closingBrace = optionsNode.end - 1;
      const between = file.content.slice(lastProperty.end, closingBrace);
      const commaOffset = between.indexOf(",");
      const propertyIndent = lineIndent(
        file.source,
        optionsNode.properties[0].getStart(file.source),
      );
      const insertion =
        commaOffset === -1
          ? {
              position: lastProperty.end - callStart,
              text: `,\n${propertyIndent}${fields.join(`\n${propertyIndent}`)}`,
            }
          : {
              position: lastProperty.end + commaOffset + 1 - callStart,
              text: `\n${propertyIndent}${fields.join(`\n${propertyIndent}`)}`,
            };
      edits.push({
        start: insertion.position,
        end: insertion.position,
        text: insertion.text,
      });
    }
  }

  return edits
    .sort((left, right) => right.start - left.start)
    .reduce(
      (text, edit) =>
        text.slice(0, edit.start) + edit.text + text.slice(edit.end),
      offer.callText,
    );
}

function refreshOptions(proposal: ParsedOffer) {
  const result = new Map<string, string>();
  for (const name of [
    "observedAt",
    "expiresAt",
    "available",
    "stock",
    "verificationMethod",
  ]) {
    const value = optionText(proposal, name);
    if (value !== undefined) result.set(name, value);
  }
  return result;
}

function matchesRefresh(
  current: ParsedOffer,
  proposal: ParsedOffer,
  desired: Map<string, string>,
) {
  return (
    current.priceNgn === proposal.priceNgn &&
    [...desired].every(([name, value]) => optionText(current, name) === value)
  );
}

/**
 * Replays one cron-produced proposal onto the current main data tree.
 *
 * Git history supplies the exact common-ancestor, current, and proposal trees;
 * this function resolves only conflict classes already admitted by the static
 * sync contract. Newer evidence and deliberate removals on main supersede an
 * older proposal. Any identity/package retarget or same-timestamp disagreement
 * remains a hard conflict.
 */
export function mergeStaticSyncProposal(input: {
  baseContent: string;
  currentContent: string;
  proposalContent: string;
}): StaticSyncProposalMerge {
  const proposalValidation = validateStaticSyncProposal({
    baseContent: input.baseContent,
    candidateContent: input.proposalContent,
  });
  const base = parseOffersFile(input.baseContent, "merge base");
  const current = parseOffersFile(input.currentContent, "current main");
  const proposal = parseOffersFile(input.proposalContent, "proposal");
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  let applied = 0;
  let alreadyApplied = 0;
  let staleSkipped = 0;
  let removedSkipped = 0;

  for (const key of proposalValidation.offerKeys) {
    const baseOffer = base.offerByKey.get(key);
    const proposalOffer = proposal.offerByKey.get(key);
    if (!baseOffer || !proposalOffer)
      fail(`History lost proposal offer ${key}`);
    const classification = classifyChangedOffer(base, baseOffer, proposalOffer);
    const sameRetailer = current.offers.filter(
      (offer) =>
        offer.slug === baseOffer.slug && offer.retailer === baseOffer.retailer,
    );
    const identity = coreIdentity(baseOffer);
    const matches = sameRetailer.filter(
      (offer) => coreIdentity(offer) === identity,
    );
    if (matches.length === 0) {
      if (sameRetailer.length === 0) {
        removedSkipped++;
        continue;
      }
      fail(`${key} was retargeted on main; identity conflicts require review`);
    }
    if (matches.length > 1) {
      fail(`${key} is ambiguous on current main`);
    }
    const currentOffer = matches[0];
    const currentObserved = observedTimestamp(current, currentOffer);
    const baseObserved = observedTimestamp(base, baseOffer);
    const proposalObserved = observedTimestamp(proposal, proposalOffer);
    let updatedCall: string;

    if (classification === "refresh") {
      if (currentObserved > proposalObserved) {
        staleSkipped++;
        continue;
      }
      const desired = refreshOptions(proposalOffer);
      if (currentObserved === proposalObserved) {
        if (matchesRefresh(currentOffer, proposalOffer, desired)) {
          alreadyApplied++;
          continue;
        }
        fail(`${key} has divergent evidence at the same observation time`);
      }
      updatedCall = rewriteOfferCall({
        file: current,
        offer: currentOffer,
        priceNgn: proposalOffer.priceNgn,
        options: desired,
      });
    } else {
      if (currentObserved > baseObserved) {
        staleSkipped++;
        continue;
      }
      if (currentObserved < baseObserved) {
        fail(`${key} current evidence predates the proposal base`);
      }
      if (currentOffer.priceNgn !== baseOffer.priceNgn) {
        fail(`${key} price diverged before terminal invalidation`);
      }
      if (
        optionText(currentOffer, "verificationMethod") !==
        optionText(baseOffer, "verificationMethod")
      ) {
        fail(`${key} provenance diverged before terminal invalidation`);
      }
      const proposalExpiryText = optionString(proposalOffer, "expiresAt");
      const proposalExpiry = timestamp(
        proposalExpiryText,
        `${key} proposal expiresAt`,
      );
      const currentExpiryText = optionString(currentOffer, "expiresAt");
      const currentExpiry = currentExpiryText
        ? timestamp(currentExpiryText, `${key} current expiresAt`)
        : Number.POSITIVE_INFINITY;
      const expiresAt =
        currentExpiry <= proposalExpiry
          ? optionText(currentOffer, "expiresAt")!
          : optionText(proposalOffer, "expiresAt")!;
      updatedCall = rewriteOfferCall({
        file: current,
        offer: currentOffer,
        options: new Map([
          ["expiresAt", expiresAt],
          ["available", "false"],
          ["stock", '"unknown"'],
        ]),
      });
    }

    if (updatedCall === currentOffer.callText) {
      alreadyApplied++;
      continue;
    }
    replacements.push({
      start: currentOffer.call.getStart(current.source),
      end: currentOffer.call.end,
      text: updatedCall,
    });
    applied++;
  }

  const content = replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (text, replacement) =>
        text.slice(0, replacement.start) +
        replacement.text +
        text.slice(replacement.end),
      input.currentContent,
    );
  if (applied > 0) {
    validateStaticSyncProposal({
      baseContent: input.currentContent,
      candidateContent: content,
    });
  }
  return {
    content,
    proposalChanges: proposalValidation.changedOffers,
    applied,
    alreadyApplied,
    staleSkipped,
    removedSkipped,
  };
}
