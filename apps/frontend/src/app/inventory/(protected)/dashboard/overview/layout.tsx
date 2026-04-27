export const metadata = {
	title: "Inventory Dashboard - Aria ERP",
	description: "Real-time inventory management and stock tracking dashboard",
};

export default function OverViewLayout({
	children,
}: {
	children: React.ReactNode;
	sales: React.ReactNode;
	bar_stats: React.ReactNode;
	pie_stats: React.ReactNode;
	area_stats: React.ReactNode;
}) {
	return <>{children}</>;
}
