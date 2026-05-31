import { Module } from "@nestjs/common";
import { AssetService } from "./asset.service";
import { AssetRouter } from "./trpc/asset.router";

@Module({
	providers: [AssetService, AssetRouter],
	exports: [AssetRouter],
})
export class AssetModule {}
