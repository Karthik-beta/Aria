import { RevenueTrendChart } from '@/features/crm/components/revenue-trend-chart';

export default async function AreaStats() {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return <RevenueTrendChart />;
}
