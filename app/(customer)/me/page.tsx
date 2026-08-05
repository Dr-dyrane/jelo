import { MePortal } from '@/components/me/home/me-home';
import { requireCustomer } from '@/lib/customer/access';
import { readMeHome } from '@/lib/customer/route-read-models';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const customer = await requireCustomer();
  const homeModel = await readMeHome(customer);
  return <MePortal homeModel={homeModel} route={{ kind: 'home' }} />;
}
