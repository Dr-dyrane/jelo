import { MePortal } from '@/components/me/home/me-home';
import { requireCustomer } from '@/lib/customer/access';
import { readCustomerPortal } from '@/lib/customer/read-model';

export default async function MeProductNotFound() {
  const customer = await requireCustomer();
  const viewModel = await readCustomerPortal(customer);
  return <MePortal viewModel={viewModel} route={{ kind: 'not-found' }} />;
}
