"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SignInViewPage() {
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl");
	return (
		<div className="relative min-h-screen grid place-items-center lg:max-w-none lg:px-0">
			<Link
				href="/examples/authentication"
				className={cn(
					buttonVariants({ variant: "ghost" }),
					"absolute top-4 right-4 hidden md:top-8 md:right-8",
				)}
			>
				Login
			</Link>
			<div className="bg-muted relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r">
				<div className="absolute inset-0 bg-zinc-900" />
				<div className="relative z-20 flex items-center text-lg font-medium">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="mr-2 h-6 w-6"
					>
						<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
					</svg>
					Pivotr
				</div>
				<div className="relative z-20 mt-auto">
					<blockquote className="space-y-2">
						<p className="text-lg">
							&ldquo;Aria ERP unifies all our business operations—assets, CRM,
							HR, and inventory—into one seamless, modern platform.&rdquo;
						</p>
						<footer className="text-sm">Pivotr Team</footer>
					</blockquote>
				</div>
			</div>
			<div className="flex h-full items-center justify-center p-4 lg:p-8">
				<div className="flex w-full max-w-md flex-col items-center justify-center space-y-6">
					{/* github link  */}
					{/* <Link
            className={cn('group inline-flex hover:text-yellow-200')}
            target="_blank"
            href={'https://github.com/kiranism/next-shadcn-dashboard-starter'}
          >
            <div className="flex items-center">
              <GitHubLogoIcon className="size-4" />
              <span className="ml-1 inline">Star on GitHub</span>{' '}
            </div>
            <div className="ml-2 flex items-center gap-1 text-sm md:flex">
              <IconStar
                className="size-4 text-gray-500 transition-all duration-300 group-hover:text-yellow-300"
                fill="currentColor"
              />
              <span className="font-display font-medium">{stars}</span>
            </div>
          </Link> */}
					<div className="flex w-full flex-col items-center gap-4 rounded-xl border border-dashed border-primary/40 bg-muted/40 p-6 text-center">
						<span className="text-lg font-semibold">
							Authentication disabled
						</span>
						<p className="text-muted-foreground text-sm">
							User sign-in is not required for this preview build. Head straight
							to the dashboard to explore the experience.
						</p>
						<Link
							href={callbackUrl || "/inventory/dashboard/overview"}
							className={cn(
								buttonVariants({ variant: "default" }),
								"w-full md:w-auto",
							)}
						>
							Continue to dashboard
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
