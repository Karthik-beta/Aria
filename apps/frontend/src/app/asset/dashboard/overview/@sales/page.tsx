import { RecentAssetActivities } from '@/features/asset/components/recent-asset-activities';

export default async function Sales() {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return <RecentAssetActivities />;
}
