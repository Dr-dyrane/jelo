import 'server-only';

import { createCustomerRoutineService } from './routine-policy';
import { postgresCustomerRoutineRepository } from './routine-repository';

export type { CustomerRoutineActionResult, CustomerRoutineContextResult, CustomerRoutineReadResult, CustomerRoutineSummaryResult } from './routine-policy';

export const customerRoutineService = createCustomerRoutineService(
  postgresCustomerRoutineRepository,
);
