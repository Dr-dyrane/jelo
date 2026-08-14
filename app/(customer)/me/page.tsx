import { MePortal } from '@/components/me/home/me-home';
import { requireCustomer } from '@/lib/customer/access';
import { measureCustomerPrivateResultOperation } from '@/lib/customer/private-telemetry';
import { readMeHome } from '@/lib/customer/route-read-models';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const customer = await requireCustomer();
  const homeModel = await measureCustomerPrivateResultOperation(
    { surface: 'home', operation: 'read' },
    async () => await readMeHome(customer),
    model =>
      model.shelfSection.state.status === 'ready'
      && model.routineSection.state.status === 'ready',
  );
  return <MePortal homeModel={homeModel} route={{ kind: 'home' }} />;
}
