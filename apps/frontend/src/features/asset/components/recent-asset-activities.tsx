import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const assetActivities = [
	{
		asset: "CNC Machine #A-342",
		location: "Factory Floor 2, Pune",
		fallback: "CN",
		activity: "Preventive Maintenance",
		value: "₹12,500",
	},
	{
		asset: "Delivery Van MH-02-AB-1234",
		location: "Warehouse B, Mumbai",
		fallback: "DV",
		activity: "Oil Change & Inspection",
		value: "₹8,400",
	},
	{
		asset: "Laptop Dell XPS-15",
		location: "IT Department, Bangalore",
		fallback: "LP",
		activity: "Hardware Upgrade",
		value: "₹15,000",
	},
	{
		asset: "Generator 250KVA",
		location: "Building A, Chennai",
		fallback: "GN",
		activity: "Routine Check",
		value: "₹6,200",
	},
	{
		asset: "HVAC System #3",
		location: "Office Block C, Delhi",
		fallback: "HV",
		activity: "Filter Replacement",
		value: "₹4,800",
	},
];

export function RecentAssetActivities() {
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Recent Asset Activities</CardTitle>
				<CardDescription>
					You completed 42 maintenance activities this month.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-8">
					{assetActivities.map((activity, index) => (
						<div key={index} className="flex items-center">
							<Avatar className="h-9 w-9">
								<AvatarFallback>{activity.fallback}</AvatarFallback>
							</Avatar>
							<div className="ml-4 space-y-1">
								<p className="text-sm leading-none font-medium">
									{activity.asset}
								</p>
								<p className="text-muted-foreground text-sm">
									{activity.location}
								</p>
							</div>
							<div className="ml-auto font-medium">{activity.value}</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
