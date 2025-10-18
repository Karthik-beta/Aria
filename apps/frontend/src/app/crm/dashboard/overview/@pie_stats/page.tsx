import { LeadSourceChart } from '@/features/crm/components/lead-source-chart';

export default async function Stats() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return <LeadSourceChart />;
}
