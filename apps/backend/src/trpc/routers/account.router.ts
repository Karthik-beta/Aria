import type { PrismaService } from "../../shared/prisma.service";
import { protectedProcedure, router } from "../trpc";

export const accountRouter = router({
	markPasswordUpdated: protectedProcedure.mutation(async ({ ctx }) => {
		const prisma = ctx.prisma as unknown as PrismaService;
		await prisma.user.update({
			where: { id: ctx.user.id },
			data: {
				mustChangePassword: false,
				passwordChangedAt: new Date(),
			},
		});

		return { success: true };
	}),
});
