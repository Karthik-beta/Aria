import { SalesPipelineChart } from '@/features/crm/components/sales-pipeline-chart';

export default async function BarStats() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return <SalesPipelineChart />;
}
