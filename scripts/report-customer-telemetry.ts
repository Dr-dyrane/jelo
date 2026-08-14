import {
  CUSTOMER_PRIVATE_TELEMETRY_DEFAULT_REPORT_DAYS,
  parseCustomerPrivateTelemetryEnvironment,
  readCustomerPrivateTelemetryReport,
  type CustomerPrivateTelemetryEnvironment,
} from '@/lib/customer/private-telemetry';

function reportOptions(arguments_: readonly string[]) {
  let environment: CustomerPrivateTelemetryEnvironment = 'production';
  let days = CUSTOMER_PRIVATE_TELEMETRY_DEFAULT_REPORT_DAYS;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = arguments_[index + 1];
    if (argument === '--environment') {
      if (!value || value.startsWith('--')) {
        throw new Error('customer_private_telemetry_environment_missing');
      }
      environment = parseCustomerPrivateTelemetryEnvironment(value);
      index += 1;
      continue;
    }
    if (argument === '--days') {
      if (!value || !/^(?:[1-9]|[12][0-9]|3[0-5])$/.test(value)) {
        throw new Error('customer_private_telemetry_report_days_invalid');
      }
      days = Number(value);
      index += 1;
      continue;
    }
    throw new Error('customer_private_telemetry_report_argument_invalid');
  }

  return { environment, days };
}

async function main() {
  const report = await readCustomerPrivateTelemetryReport(
    reportOptions(process.argv.slice(2)),
  );
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  const message =
    code === 'customer_private_telemetry_redis_not_configured'
      ? 'KV_REST_API_URL and KV_REST_API_TOKEN are required.'
      : code === 'customer_private_telemetry_environment_invalid'
        ? 'Environment must be production, preview, or development.'
        : code === 'customer_private_telemetry_report_days_invalid'
          ? 'Report days must be between 1 and 35.'
          : code === 'customer_private_telemetry_report_argument_invalid'
            ? 'Use only --environment <value> and --days <1-35>.'
            : code === 'customer_private_telemetry_environment_missing'
              ? '--environment requires a value.'
              : 'Customer private telemetry report is unavailable.';
  console.error(message);
  process.exitCode = 1;
});
