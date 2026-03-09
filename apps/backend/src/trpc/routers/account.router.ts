import { protectedProcedure, router } from "../trpc";

export const accountRouter = router({
	markPasswordUpdated: protectedProcedure.mutation(async ({ ctx }) => {
		await ctx.prisma.user.update({
			where: { id: ctx.user.id },
			data: {
				mustChangePassword: false,
				passwordChangedAt: new Date(),
			},
		});

		return { success: true };
	}),
});
