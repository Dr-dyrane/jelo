import 'server-only';

import {
  postgresCustomerShelfRepository,
} from './shelf-repository';
import { createCustomerShelfService } from './shelf-policy';

export type { CustomerShelfActionResult, CustomerShelfContextResult, CustomerShelfCountResult, CustomerShelfReadResult } from './shelf-policy';

export const customerShelfService = createCustomerShelfService(postgresCustomerShelfRepository);
