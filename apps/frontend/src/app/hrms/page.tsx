import { redirect } from 'next/navigation';

export default function HRMSHome() {
  redirect('/hrms/dashboard/overview');
}
