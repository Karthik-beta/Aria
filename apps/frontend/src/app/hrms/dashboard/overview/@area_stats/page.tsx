import { LeaveTrendChart } from '@/features/hrms/components/leave-trend-chart';

export default async function AreaStats() {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return <LeaveTrendChart />;
}
