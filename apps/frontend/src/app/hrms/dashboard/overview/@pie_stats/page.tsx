import { DepartmentDistributionChart } from '@/features/hrms/components/department-distribution-chart';

export default async function Stats() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return <DepartmentDistributionChart />;
}
