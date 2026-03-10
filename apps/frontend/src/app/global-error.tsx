"use client";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					minHeight: "100vh",
					fontFamily:
						'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					backgroundColor: "#09090b",
					color: "#fafafa",
				}}
			>
				<title>Application Error</title>
				<main
					style={{
						display: "flex",
						minHeight: "100vh",
						alignItems: "center",
						justifyContent: "center",
						padding: "24px",
					}}
				>
					<div
						style={{
							width: "100%",
							maxWidth: "480px",
							border: "1px solid rgba(255, 255, 255, 0.12)",
							borderRadius: "16px",
							padding: "32px",
							backgroundColor: "rgba(24, 24, 27, 0.96)",
							boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
						}}
					>
						<p
							style={{
								margin: 0,
								fontSize: "12px",
								fontWeight: 700,
								letterSpacing: "0.12em",
								textTransform: "uppercase",
								color: "#f59e0b",
							}}
						>
							Application error
						</p>
						<h1
							style={{
								margin: "16px 0 12px",
								fontSize: "30px",
								lineHeight: 1.1,
							}}
						>
							Something went wrong.
						</h1>
						<p
							style={{
								margin: 0,
								fontSize: "16px",
								lineHeight: 1.6,
								color: "rgba(250, 250, 250, 0.78)",
							}}
						>
							The application hit an unexpected error while rendering this page.
						</p>
						{error.digest ? (
							<p
								style={{
									margin: "20px 0 0",
									fontSize: "14px",
									lineHeight: 1.5,
									color: "rgba(250, 250, 250, 0.62)",
								}}
							>
								Error reference:{" "}
								<code
									style={{
										fontFamily:
											'ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
									}}
								>
									{error.digest}
								</code>
							</p>
						) : null}
						<button
							onClick={() => reset()}
							style={{
								marginTop: "24px",
								border: 0,
								borderRadius: "9999px",
								padding: "12px 18px",
								fontSize: "14px",
								fontWeight: 700,
								cursor: "pointer",
								backgroundColor: "#fafafa",
								color: "#09090b",
							}}
							type="button"
						>
							Try again
						</button>
					</div>
				</main>
			</body>
		</html>
	);
}
