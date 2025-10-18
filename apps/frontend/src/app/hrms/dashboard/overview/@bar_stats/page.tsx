import { AttendanceChart } from '@/features/hrms/components/attendance-chart';

export default async function BarStats() {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return <AttendanceChart />;
}
