import { AssetUtilizationChart } from '@/features/asset/components/asset-utilization-chart';

export default async function BarStats() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return <AssetUtilizationChart />;
}
