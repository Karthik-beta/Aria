# 🤝 Customer Relationship Management (CRM) Frontend

The **CRM Frontend** helps you manage relationships with customers from first contact to closed deals. Built with **Next.js 15**, it streamlines your sales process and customer interactions.

## 📋 What Does This Do?

This application helps you:
- **Manage contacts** - Store customer information in one place
- **Track leads** - Monitor potential customers through your sales pipeline
- **Close deals** - Move opportunities from lead to customer
- **Log activities** - Record calls, meetings, and emails
- **View reports** - Analyze sales performance and customer trends

Think of it as your sales team's command center!

## 🚀 Quick Start

### First Time Setup

```bash
# 1. Install all dependencies (run from project root)
pnpm install

# 2. Start the development server
pnpm --filter crm dev
```

The app will open at `http://localhost:3002` (or the next available port).

### Common Commands

| What You Want To Do | Command | What Happens |
|---------------------|---------|--------------||
| Start the app | `pnpm --filter crm dev` | Runs in development mode with hot-reload |
| Build for production | `pnpm --filter crm build` | Creates optimized production build |
| Run tests | `pnpm --filter crm test` | Runs component tests |
| Check code style | `pnpm --filter crm lint` | Finds and fixes formatting issues |

## 📁 Project Structure

```
apps/frontend/CRM/
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── page.tsx               # Home page (CRM dashboard)
│   │   ├── contacts/              # Contact management
│   │   ├── leads/                 # Lead tracking
│   │   ├── deals/                 # Deal pipeline
│   │   └── layout.tsx             # Shared layout
│   ├── components/                # Reusable UI components
│   │   ├── ContactCard.tsx
│   │   ├── PipelineView.tsx
│   │   └── ActivityLog.tsx
│   ├── lib/                       # Utilities and helpers
│   └── styles/                    # Global styles
└── public/                        # Static assets
```

## 🔒 Type Safety & Shared Code

### Using Shared Types

```typescript
// Import CRM-specific types from shared package
import { CRM } from '@aria/types';

function ContactList({ contacts }: { contacts: CRM.Contact[] }) {
  return (
    <div>
      {contacts.map(contact => (
        <div key={contact.id}>{contact.name}</div>
      ))}
    </div>
  );
}
```

### Path Aliases

```typescript
// Use @crm/* for clean imports
import { ContactCard } from '@crm/components/ContactCard';
import { fetchContacts } from '@crm/lib/api';
```

## 📚 Key Features to Implement

### Contact Management
- Create, edit, and delete contacts
- Store contact information (name, email, phone, company)
- Link contacts to deals and activities

### Lead Tracking
- Capture new leads from forms
- Qualify leads (hot, warm, cold)
- Convert leads to customers

### Sales Pipeline
- Visual pipeline with drag-and-drop
- Stages: Lead → Qualified → Proposal → Negotiation → Closed
- Track deal value and probability

### Activity Logging
- Record calls, emails, and meetings
- Set follow-up reminders
- View activity timeline

## 💡 Pro Tips for CRM

- **Keyboard Shortcuts**: Add keyboard shortcuts for quick actions (Ctrl+N for new contact)
- **Search**: Implement fast search across all contacts and companies
- **Filters**: Let users filter by stage, owner, date range
- **Export**: Allow exporting contacts/leads to CSV
- **Mobile-First**: Many sales reps use mobile devices—design accordingly

## 🐛 Common Issues

### Drag-and-Drop Not Working?
- Ensure you're using a drag-and-drop library (like `@dnd-kit/core`)
- Check that you've added `'use client'` to interactive components

### Forms Not Submitting?
- Verify backend API is running
- Check network tab for errors
- Ensure form data matches the expected type

## 🔗 Related Documentation

- [Main Project README](../../../README.md)
- [Backend API README](../../backend/README.md)
- [Shared Types](../../../packages/types/README.md)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Need Help?** Review the `src/components/` directory for component examples!
