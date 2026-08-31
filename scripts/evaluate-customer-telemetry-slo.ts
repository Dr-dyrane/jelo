import { readCustomerPrivateTelemetryReport } from "@/lib/customer/private-telemetry";
import {
  evaluateCustomerPrivateTelemetrySlo,
  type CustomerPrivateTelemetrySloMinimumTraffic,
  type CustomerPrivateTelemetrySloStatus,
} from "@/lib/customer/private-telemetry-slo";

const EXIT_CODE: Record<CustomerPrivateTelemetrySloStatus, number> = {
  pass: 0,
  fail: 1,
  "not-evaluable": 2,
};
const ERROR_EXIT_CODE = 3;

function parsePositiveInteger(value: string | undefined) {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function minimumTrafficOptions(
  arguments_: readonly string[],
): CustomerPrivateTelemetrySloMinimumTraffic {
  let minimumReadOperations: number | null = null;
  let minimumWriteOperations: number | null = null;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = parsePositiveInteger(arguments_[index + 1]);
    if (
      argument === "--minimum-read" &&
      minimumReadOperations === null &&
      value !== null
    ) {
      minimumReadOperations = value;
      index += 1;
      continue;
    }
    if (
      argument === "--minimum-write" &&
      minimumWriteOperations === null &&
      value !== null
    ) {
      minimumWriteOperations = value;
      index += 1;
      continue;
    }
    throw new Error("customer_private_telemetry_slo_argument_invalid");
  }

  if (minimumReadOperations === null || minimumWriteOperations === null) {
    throw new Error("customer_private_telemetry_slo_argument_invalid");
  }
  return { minimumReadOperations, minimumWriteOperations };
}

async function main() {
  const minimumTraffic = minimumTrafficOptions(process.argv.slice(2));
  const report = await readCustomerPrivateTelemetryReport({
    environment: "production",
    days: 28,
  });
  const evaluation = evaluateCustomerPrivateTelemetrySlo(
    report,
    minimumTraffic,
  );
  console.log(JSON.stringify(evaluation, null, 2));
  process.exitCode = EXIT_CODE[evaluation.status];
}

void main().catch(() => {
  console.error("Customer private telemetry SLO evaluation is unavailable.");
  process.exitCode = ERROR_EXIT_CODE;
});
