import { redirect } from 'next/navigation';

// There is nothing to share without a product. Send people to the catalogue,
// where each product offers its own share link.
export default function ShareIndex() {
  redirect('/products');
}
