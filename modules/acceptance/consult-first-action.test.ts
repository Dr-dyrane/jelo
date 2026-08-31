import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/(site)/consult/page.tsx", "utf8");
const pageStyles = readFileSync(
  "app/(site)/consult/consult-page.module.css",
  "utf8",
);
const experience = readFileSync(
  "components/consult/consult-experience.tsx",
  "utf8",
);
const siteLayout = readFileSync("app/(site)/layout.tsx", "utf8");

test("public consult puts the real task before optional help", () => {
  const composer = experience.indexOf(
    '<form\n        className="consult-form"',
  );
  const examples = experience.indexOf(
    '<details className="consult-disclosure"',
  );
  const profile = experience.indexOf('className="profile-trigger"');

  assert.notEqual(composer, -1);
  assert.notEqual(examples, -1);
  assert.notEqual(profile, -1);
  assert.ok(composer < examples);
  assert.ok(composer < profile);
  assert.match(experience, /<summary>[\s\S]*Need an example\?/);
  assert.match(experience, /Include saved details/);
  assert.match(experience, /Get my assessment/);
  assert.doesNotMatch(experience, /confidenceLabel|Other patterns considered/);
  assert.match(experience, /Urgent or worsening[\s\S]*in-person care/);
  assert.match(siteLayout, /Evidence-led care, with clear[\s\S]*next steps/);
  assert.doesNotMatch(siteLayout, /Guidance, not diagnosis/);
});

test("mobile consult orders intro, composer and photography around the task", () => {
  assert.match(page, /Tell us what you notice\./);
  assert.match(page, /assess what is most[\s\S]*likely/);
  assert.match(page, /<ConsultExperience initialQuery=\{initialQuery\}/);
  assert.match(page, /<SafeEditorialImage/);
  assert.match(
    pageStyles,
    /@media \(max-width: 620px\)[\s\S]*grid-template-areas:\s*"heading"\s*"experience"\s*"visual"/,
  );
});
