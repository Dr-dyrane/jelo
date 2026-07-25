import { Skeleton } from '@/components/ops/state/Skeleton';
import opsStyles from '../../ops.module.css';

// Suspense fallback while the force-dynamic query resolves. Skeleton in the inbox
// row geometry — never a spinner, no reflow into the ready state.
export default function LoadingObservations() {
  return (
    <>
      <h1 className={opsStyles.h1}>Community observations</h1>
      <p className={opsStyles.lede}>Reported prices and outcomes awaiting review.</p>
      <Skeleton variant="row" count={8} />
    </>
  );
}
