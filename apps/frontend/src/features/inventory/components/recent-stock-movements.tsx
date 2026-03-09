import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const stockMovements = [
	{
		item: 'MacBook Pro 16"',
		warehouse: "Mumbai Warehouse",
		fallback: "MP",
		quantity: "+45 units",
		value: "₹12,34,500",
	},
	{
		item: "Office Chair Premium",
		warehouse: "Delhi Distribution Center",
		fallback: "OC",
		quantity: "-12 units",
		value: "₹48,000",
	},
	{
		item: "Wireless Mouse",
		warehouse: "Bangalore Hub",
		fallback: "WM",
		quantity: "+120 units",
		value: "₹36,000",
	},
	{
		item: 'LED Monitor 27"',
		warehouse: "Pune Warehouse",
		fallback: "LM",
		quantity: "+28 units",
		value: "₹3,92,000",
	},
	{
		item: "Printer Cartridge",
		warehouse: "Chennai Facility",
		fallback: "PC",
		quantity: "-8 units",
		value: "₹12,400",
	},
];

export function RecentStockMovements() {
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Recent Stock Movements</CardTitle>
				<CardDescription>
					You processed 187 stock transactions this week.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-8">
					{stockMovements.map((movement, index) => (
						<div key={index} className="flex items-center">
							<Avatar className="h-9 w-9">
								<AvatarFallback>{movement.fallback}</AvatarFallback>
							</Avatar>
							<div className="ml-4 space-y-1">
								<p className="text-sm leading-none font-medium">
									{movement.item}
								</p>
								<p className="text-muted-foreground text-sm">
									{movement.warehouse}
								</p>
							</div>
							<div className="ml-auto font-medium">{movement.value}</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
