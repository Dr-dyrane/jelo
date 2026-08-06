import 'server-only';

import { postgresCustomerConcernRepository } from './concern-repository';
import { createCustomerConcernService } from './concern-policy';

export type { CustomerConcernActionResult, CustomerConcernReadResult } from './concern-policy';

export const customerConcernService = createCustomerConcernService(
  postgresCustomerConcernRepository,
);
