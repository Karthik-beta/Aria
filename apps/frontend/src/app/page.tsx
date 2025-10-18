import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to inventory by default (you can change this to any default app)
  redirect('/inventory');
}
