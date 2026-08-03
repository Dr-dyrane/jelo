import { MePortal } from '@/components/me/home/me-home';
import { requireCustomer } from '@/lib/customer/access';
import { readCustomerPortal } from '@/lib/customer/read-model';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const customer = await requireCustomer();
  const viewModel = await readCustomerPortal(customer);
  return <MePortal viewModel={viewModel} route={{ kind: 'home' }} />;
}
