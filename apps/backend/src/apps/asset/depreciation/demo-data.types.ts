export interface DemoDepreciationScope {
	throughDate: Date;
	companyId?: string;
	assetIds?: readonly string[];
}

/** Synchronizes demo history through the production BullMQ posting path. */
export interface DemoDepreciationCoordinator {
	ensurePosted(scope: DemoDepreciationScope): Promise<void>;
}
