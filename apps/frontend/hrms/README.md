# 👥 Human Resource Management System (HRMS) Frontend

The **HRMS Frontend** helps you manage everything related to employees—from hiring to payroll. Built with **Next.js 15**, it makes HR tasks simple and organized.

## 📋 What Does This Do?

This application helps you:
- **Manage employees** - Store all employee information in one place
- **Track attendance** - Monitor who's present, absent, or on leave
- **Process payroll** - Calculate salaries, deductions, and bonuses
- **Handle leave requests** - Approve or reject time-off requests
- **Track performance** - Record reviews and goals
- **Onboard new hires** - Guide new employees through the joining process

Think of it as your HR department's digital assistant!

## 🚀 Quick Start

### First Time Setup

```bash
# 1. Install all dependencies (run from project root)
pnpm install

# 2. Start the development server
pnpm --filter hrms dev
```

The app will open at `http://localhost:3003` (or the next available port).

### Common Commands

| What You Want To Do | Command | What Happens |
|---------------------|---------|--------------||
| Start the app | `pnpm --filter hrms dev` | Runs in development mode with hot-reload |
| Build for production | `pnpm --filter hrms build` | Creates optimized production build |
| Run tests | `pnpm --filter hrms test` | Runs component tests |
| Check code style | `pnpm --filter hrms lint` | Finds and fixes formatting issues |

## 📁 Project Structure

```
apps/frontend/hrms/
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── page.tsx               # Home page (HR dashboard)
│   │   ├── employees/             # Employee directory
│   │   ├── attendance/            # Time tracking
│   │   ├── payroll/               # Salary management
│   │   ├── leaves/                # Leave requests
│   │   └── layout.tsx             # Shared layout
│   ├── components/                # Reusable UI components
│   │   ├── EmployeeCard.tsx
│   │   ├── AttendanceCalendar.tsx
│   │   └── PayslipGenerator.tsx
│   ├── lib/                       # Utilities and helpers
│   └── styles/                    # Global styles
└── public/                        # Static assets
```

## 🔒 Type Safety & Shared Code

### Using Shared Types

```typescript
// Import HR-specific types
import { HR } from '@aria/types';

function EmployeeList({ employees }: { employees: HR.Employee[] }) {
  return (
    <div>
      {employees.map(emp => (
        <div key={emp.id}>
          {emp.firstName} {emp.lastName} - {emp.department}
        </div>
      ))}
    </div>
  );
}
```

### Path Aliases

```typescript
// Use @hrms/* for clean imports
import { EmployeeCard } from '@hrms/components/EmployeeCard';
import { calculateSalary } from '@hrms/lib/payroll';
```

## 📚 Key Features to Implement

### Employee Management
- Add, edit, and archive employee records
- Store personal details, contact info, and emergency contacts
- Track employment history and position changes

### Attendance Tracking
- Clock in/out functionality
- Calendar view of attendance
- Overtime calculation
- Attendance reports

### Leave Management
- Submit leave requests
- Manager approval workflow
- Leave balance tracking
- Leave calendar view

### Payroll Processing
- Salary calculation with deductions
- Tax computation
- Generate payslips
- Payment history

### Performance Management
- Set goals and objectives
- Conduct reviews
- Track performance ratings
- Career development plans

## 💡 Pro Tips for HRMS

- **Calendar Integration**: Use a date picker library like `react-day-picker` for attendance/leave
- **PDF Generation**: Use libraries like `react-pdf` or `jsPDF` for payslips
- **Privacy First**: Implement role-based access—not everyone should see salaries!
- **Notifications**: Send email alerts for leave approvals, payroll processing
- **Mobile Friendly**: Employees often check attendance from phones

## 🐛 Common Issues

### Date/Time Issues?
- Use a library like `date-fns` or `dayjs` for consistent date handling
- Always store dates in UTC, display in local timezone

### Payroll Calculations Wrong?
- Double-check tax brackets and deduction rules
- Write unit tests for salary calculation functions
- Validate against expected results

### Performance Slow with Large Employee Lists?
- Implement pagination (show 50 employees per page)
- Add search and filters
- Use virtual scrolling for very large lists

## 🔗 Related Documentation

- [Main Project README](../../../README.md)
- [Backend API README](../../backend/README.md)
- [Shared Types](../../../packages/types/README.md)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Need Help?** Review the `src/components/` directory for component examples!
