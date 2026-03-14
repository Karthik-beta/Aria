import { IconBrandGithub } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export default function CtaGithub() {
	return (
		<Button variant="ghost" asChild size="sm" className="hidden sm:flex">
			<a
				href="https://github.com/Kiranism/next-shadcn-dashboard-starter"
				rel="noopener noreferrer"
				target="_blank"
				className="dark:text-foreground"
			>
				<IconBrandGithub />
			</a>
		</Button>
	);
}
