import { Button } from '@aria/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@aria/ui';
import { Input } from '@aria/ui';
import { Label } from '@aria/ui';

export default function Home() {
  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Welcome to{' '}
            <span className="text-primary">
              Aria ERP
              <span className="text-sm sm:text-base font-medium block text-muted-foreground">
                Asset Management System
              </span>
            </span>
          </h1>
          <p className="text-muted-foreground text-lg">Powered by Shadcn UI & Tailwind CSS v4</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Components Demo</CardTitle>
              <CardDescription>
                Explore the shared UI components from @aria/ui package
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Enter your email" />
              </div>
              <div className="flex gap-2">
                <Button>Primary Button</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monorepo Architecture</CardTitle>
              <CardDescription>Shared components across all frontend apps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This monorepo includes 4 Next.js frontends sharing a common UI library:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>Asset Management</li>
                <li>CRM System</li>
                <li>HRMS Platform</li>
                <li>Inventory Control</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Technology Stack</CardTitle>
            <CardDescription>Latest tools and frameworks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-2">
                <div className="text-2xl font-bold">Next.js</div>
                <div className="text-sm text-muted-foreground">15.5.4</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold">React</div>
                <div className="text-sm text-muted-foreground">19.1.0</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold">Tailwind</div>
                <div className="text-sm text-muted-foreground">v4</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold">Shadcn UI</div>
                <div className="text-sm text-muted-foreground">Latest</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img aria-hidden src="file.svg" alt="File icon" width={16} height={16} />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img aria-hidden src="window.svg" alt="Window icon" width={16} height={16} />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img aria-hidden src="globe.svg" alt="Globe icon" width={16} height={16} />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
