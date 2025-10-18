import { DepreciationTrendChart } from '@/features/asset/components/depreciation-trend-chart';

export default async function AreaStats() {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return <DepreciationTrendChart />;
}
