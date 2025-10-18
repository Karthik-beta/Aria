import { redirect } from 'next/navigation';

export default function CRMHome() {
  redirect('/crm/dashboard/overview');
}
