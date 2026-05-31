/**
 * Asset Category Detail — redirects to the form page for editing.
 *
 * The canonical edit URL is /asset-category/form?id=<categoryId>.
 * This route exists for bookmarked or shared links and transparently
 * sends users to the correct form.
 */
import { redirect } from "next/navigation";

export default async function AssetCategoryDetailPage({
	params,
}: {
	params: Promise<{ categoryId: string }>;
}) {
	const { categoryId } = await params;
	redirect(`/asset/asset-sub-module/asset-category/form?id=${categoryId}`);
}
