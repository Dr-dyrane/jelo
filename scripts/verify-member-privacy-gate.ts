import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  formatMemberPrivacyGateVerification,
  memberPrivacyGateExitCode,
  verifyMemberPrivacyGateRecord,
} from '../lib/member-privacy/gate-contract';

type GateMode = 'review' | 'authorization';

type CliOptions = {
  mode: GateMode;
  recordPath: string;
};

type CliRuntimeOptions = {
  cwd?: string;
  now?: Date;
};

export type MemberPrivacyGateCliResult = {
  exitCode: number;
  line: string;
};

function parseArguments(args: string[]): CliOptions | null {
  const modeArguments = args.filter(argument => argument.startsWith('--mode='));
  const recordArguments = args.filter(argument => argument.startsWith('--record='));
  if (args.some(argument => !argument.startsWith('--mode=') && !argument.startsWith('--record='))) return null;
  if (modeArguments.length !== 1 || recordArguments.length > 1) return null;

  const mode = modeArguments[0].slice('--mode='.length);
  if (mode !== 'review' && mode !== 'authorization') return null;
  const recordPath = recordArguments[0]?.slice('--record='.length) ?? 'data/member-privacy/gates/g0.json';
  if (!recordPath) return null;
  return { mode, recordPath };
}

export async function runMemberPrivacyGateCli(
  args: string[],
  runtime: CliRuntimeOptions = {},
): Promise<MemberPrivacyGateCliResult> {
  const options = parseArguments(args);
  if (!options) {
    return {
      exitCode: 1,
      line: 'G0 verifier invalid: invalid:cli:arguments',
    };
  }

  let input: unknown;
  try {
    const absolutePath = path.resolve(runtime.cwd ?? process.cwd(), options.recordPath);
    input = JSON.parse(await readFile(absolutePath, 'utf8')) as unknown;
  } catch {
    return {
      exitCode: 1,
      line: 'G0 verifier invalid: invalid:record:unreadable_or_malformed_json',
    };
  }

  const verification = verifyMemberPrivacyGateRecord(input, { now: runtime.now });
  return {
    exitCode: memberPrivacyGateExitCode(verification, options.mode),
    line: formatMemberPrivacyGateVerification(verification, options.mode),
  };
}

async function main() {
  const result = await runMemberPrivacyGateCli(process.argv.slice(2));
  if (result.exitCode === 0) console.log(result.line);
  else console.error(result.line);
  process.exitCode = result.exitCode;
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryPoint) {
  main().catch(() => {
    console.error('G0 verifier invalid: invalid:verifier:unexpected_failure');
    process.exitCode = 1;
  });
}
