"use client";

import { BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

/** Finance-book administration for independent asset depreciation schedules. */
export default function FinanceBookPage() {
	const [name, setName] = React.useState("");
	const utils = trpc.useUtils();
	const { data, isLoading } = trpc.asset.listFinanceBooks.useQuery({
		take: 250,
	});
	const createMutation = trpc.asset.createFinanceBook.useMutation({
		onSuccess: async () => {
			setName("");
			await utils.asset.listFinanceBooks.invalidate();
			toast.success("Finance book created");
		},
		onError: (error) => toast.error(getToastMessage(error, "create")),
	});
	const deleteMutation = trpc.asset.deleteFinanceBook.useMutation({
		onSuccess: async () => {
			await utils.asset.listFinanceBooks.invalidate();
			toast.success("Finance book deleted");
		},
		onError: (error) => toast.error(getToastMessage(error, "delete")),
	});

	return (
		<div className="container mx-auto space-y-6 px-4 py-6 md:px-6">
			<div>
				<h1 className="flex items-center gap-2 text-2xl font-bold">
					<BookOpen className="h-6 w-6" /> Finance Books
				</h1>
				<p className="text-sm text-muted-foreground">
					Maintain independent depreciation books used by companies and assets.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>New Finance Book</CardTitle>
					<CardDescription>
						Names must be unique across the installation.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<div className="flex-1 space-y-2">
						<Label htmlFor="finance-book-name">Name</Label>
						<Input
							id="finance-book-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="e.g. Companies Act"
						/>
					</div>
					<Button
						disabled={!name.trim() || createMutation.isPending}
						onClick={() => createMutation.mutate({ name: name.trim() })}
					>
						{createMutation.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Plus className="mr-2 h-4 w-4" />
						)}
						Add
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Configured Books</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<Loader2 className="h-5 w-5 animate-spin" />
					) : data?.items.length ? (
						<ul className="divide-y rounded-md border">
							{data.items.map((book) => (
								<li
									key={book.id}
									className="flex items-center justify-between px-4 py-3"
								>
									<span>{book.name}</span>
									<Button
										variant="ghost"
										size="icon"
										aria-label={`Delete ${book.name}`}
										disabled={deleteMutation.isPending}
										onClick={() => deleteMutation.mutate({ id: book.id })}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-muted-foreground">
							No named finance books yet.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
