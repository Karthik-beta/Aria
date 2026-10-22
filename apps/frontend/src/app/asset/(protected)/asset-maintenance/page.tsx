import { redirect } from "next/navigation";
import { ASSET_MAINTENANCE_LIST_PATH } from "./maintenance/asset-maintenance.utils";

/** `/asset/asset-maintenance` has no page of its own; send it to the list. */
export default function AssetMaintenanceIndexPage() {
	redirect(ASSET_MAINTENANCE_LIST_PATH);
}
