import { RecentDeals } from "@/features/crm/components/recent-deals";

export default async function Sales() {
	await new Promise((resolve) => setTimeout(resolve, 3000));
	return <RecentDeals />;
}
