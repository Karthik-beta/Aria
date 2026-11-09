import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const dealsData = [
	{
		customer: "Rajesh Kumar",
		company: "TechCorp India Pvt. Ltd.",
		fallback: "RK",
		stage: "Negotiation",
		value: "₹12,45,000",
	},
	{
		customer: "Priya Sharma",
		company: "Global Solutions Mumbai",
		fallback: "PS",
		stage: "Proposal",
		value: "₹8,75,000",
	},
	{
		customer: "Amit Patel",
		company: "Innovation Systems Delhi",
		fallback: "AP",
		stage: "Closed-Won",
		value: "₹15,20,000",
	},
	{
		customer: "Sneha Reddy",
		company: "Digital Ventures Bangalore",
		fallback: "SR",
		stage: "Qualification",
		value: "₹6,80,000",
	},
	{
		customer: "Vikram Singh",
		company: "Enterprise Networks Pune",
		fallback: "VS",
		stage: "Closed-Won",
		value: "₹11,25,000",
	},
];

export function RecentDeals() {
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Recent Deals</CardTitle>
				<CardDescription>
					You closed 24 deals worth ₹2.8 Cr this month.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-8">
					{dealsData.map((deal) => (
						<div
							key={`${deal.customer}-${deal.company}`}
							className="flex items-center"
						>
							<Avatar className="h-9 w-9">
								<AvatarFallback>{deal.fallback}</AvatarFallback>
							</Avatar>
							<div className="ml-4 space-y-1">
								<p className="text-sm leading-none font-medium">
									{deal.customer}
								</p>
								<p className="text-muted-foreground text-sm">{deal.company}</p>
							</div>
							<div className="ml-auto font-medium">{deal.value}</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
