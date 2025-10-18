import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';

const employeeActivities = [
  {
    employee: 'Arjun Verma',
    department: 'Engineering',
    fallback: 'AV',
    activity: 'Leave Approved - Medical',
    value: '3 days',
  },
  {
    employee: 'Sneha Reddy',
    department: 'Sales',
    fallback: 'SR',
    activity: 'Salary Disbursed',
    value: '₹85,000',
  },
  {
    employee: 'Vikram Singh',
    department: 'Operations',
    fallback: 'VS',
    activity: 'Training Completed - Safety',
    value: '8 hrs',
  },
  {
    employee: 'Kavya Iyer',
    department: 'HR',
    fallback: 'KI',
    activity: 'Onboarding Process',
    value: 'Day 1',
  },
  {
    employee: 'Rohan Desai',
    department: 'Finance',
    fallback: 'RD',
    activity: 'Performance Review',
    value: 'Q2 2024',
  },
];

export function RecentEmployeeActivities() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Employee Activities</CardTitle>
        <CardDescription>You processed 156 HR activities this month.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {employeeActivities.map((activity, index) => (
            <div key={index} className="flex items-center">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{activity.fallback}</AvatarFallback>
              </Avatar>
              <div className="ml-4 space-y-1">
                <p className="text-sm leading-none font-medium">{activity.employee}</p>
                <p className="text-muted-foreground text-sm">{activity.department}</p>
              </div>
              <div className="ml-auto font-medium">{activity.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
