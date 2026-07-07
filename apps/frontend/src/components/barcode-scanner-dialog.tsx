"use client";

import { Camera, Loader2, RefreshCw } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// Dynamically check environment to avoid build crashes (Next.js SSR safety)
const isBrowser = typeof window !== "undefined";

interface BarcodeScannerDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onScanSuccess: (scannedCode: string) => void;
}

/**
 * BarcodeScannerDialog — client-side camera modal for scanning barcodes and QR codes.
 *
 * Utilizes `@zxing/browser` for decoding and provides camera device selection.
 * Client component: safely handles Next.js SSR and cleans up camera streams on unmount/close.
 */
export function BarcodeScannerDialog({
	isOpen,
	onClose,
	onScanSuccess,
}: BarcodeScannerDialogProps) {
	const videoRef = React.useRef<HTMLVideoElement | null>(null);
	const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
	const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>("");
	const [selectedDeviceLabel, setSelectedDeviceLabel] =
		React.useState<string>("");
	const [isLoading, setIsLoading] = React.useState(true);
	const [hasPermission, setHasPermission] = React.useState<boolean | null>(
		null,
	);
	const [manualCode, setManualCode] = React.useState("");
	const controlsRef = React.useRef<{ stop: () => void } | null>(null);

	// Stop any active scanning stream
	const stopScanning = React.useCallback(() => {
		if (controlsRef.current) {
			try {
				controlsRef.current.stop();
			} catch (e) {
				// biome-ignore lint/suspicious/noConsole: error logging
				console.error("Error stopping scanner controls:", e);
			}
			controlsRef.current = null;
		}

		// Backup: explicitly stop any stream on the video element
		const currentVideo = videoRef.current;
		if (currentVideo?.srcObject) {
			try {
				const stream = currentVideo.srcObject as MediaStream;
				const tracks = stream.getTracks();
				for (const track of tracks) {
					track.stop();
				}
			} catch (e) {
				// biome-ignore lint/suspicious/noConsole: error logging
				console.error("Error stopping video ref tracks:", e);
			}
			currentVideo.srcObject = null;
		}
	}, []);

	// Reset state and close modal
	const handleClose = React.useCallback(() => {
		stopScanning();
		setIsLoading(true);
		setManualCode("");
		onClose();
	}, [onClose, stopScanning]);

	// Handle manually entered code submission
	const handleManualSubmit = React.useCallback(() => {
		if (manualCode.trim()) {
			toast.success("Code entered successfully!");
			onScanSuccess(manualCode.trim());
			handleClose();
		}
	}, [manualCode, onScanSuccess, handleClose]);

	// Compute mirroring dynamically based on whether active camera is front-facing
	const isMirrored = React.useMemo(() => {
		const activeDevice = videoDevices.find(
			(d) => d.deviceId === selectedDeviceId,
		);
		const label = (activeDevice?.label || selectedDeviceLabel).toLowerCase();
		return (
			label.includes("front") ||
			label.includes("user") ||
			label.includes("selfie")
		);
	}, [selectedDeviceId, videoDevices, selectedDeviceLabel]);

	// Load cameras and start scan
	React.useEffect(() => {
		if (!isOpen || !isBrowser) return;

		let active = true;

		async function initScanner() {
			try {
				// Import browser-only libraries dynamically inside hook to protect build
				const { BrowserMultiFormatReader } = await import("@zxing/browser");
				const { DecodeHintType } = await import("@zxing/library");

				// Configure decoding hints (TRY_HARDER increases accuracy for difficult barcodes)
				const hints = new Map();
				hints.set(DecodeHintType.TRY_HARDER, true);
				const codeReader = new BrowserMultiFormatReader(hints);

				// Ensure video element is ready
				if (!videoRef.current) {
					// Wait a tick for ref to bind
					await new Promise((resolve) => setTimeout(resolve, 50));
				}

				if (!videoRef.current || !active) return;

				// Setup constraints (prefer rear camera unless a specific device is selected)
				const constraints: MediaStreamConstraints = selectedDeviceId
					? { video: { deviceId: { exact: selectedDeviceId } } }
					: { video: { facingMode: "environment" } };

				let controls: { stop(): void };
				try {
					controls = await codeReader.decodeFromConstraints(
						constraints,
						videoRef.current,
						(result, _error) => {
							if (result && active) {
								const code = result.getText();
								if (code) {
									toast.success("Code scanned successfully!");
									onScanSuccess(code);
									handleClose();
								}
							}
						},
					);
				} catch (constraintsErr) {
					// Fallback to default camera constraints if environment facingMode is not supported
					if (!active) return;
					if (!selectedDeviceId) {
						controls = await codeReader.decodeFromConstraints(
							{ video: true },
							videoRef.current,
							(result, _error) => {
								if (result && active) {
									const code = result.getText();
									if (code) {
										toast.success("Code scanned successfully!");
										onScanSuccess(code);
										handleClose();
									}
								}
							},
						);
					} else {
						throw constraintsErr;
					}
				}

				if (!active) {
					controls.stop();
					return;
				}

				controlsRef.current = controls;
				setHasPermission(true);

				// Once the stream starts, enumerate devices to populate select dropdown with labels
				const devices = await BrowserMultiFormatReader.listVideoInputDevices();
				if (!active) return;

				setVideoDevices(devices);

				// Match active stream device with device list
				const stream = videoRef.current?.srcObject as MediaStream | null;
				const activeTrack = stream?.getVideoTracks()[0];
				const activeDeviceId = activeTrack?.getSettings()?.deviceId;

				if (activeDeviceId) {
					setSelectedDeviceId(activeDeviceId);
					const activeDevice = devices.find(
						(d) => d.deviceId === activeDeviceId,
					);
					if (activeDevice) {
						setSelectedDeviceLabel(activeDevice.label);
					}
				} else if (!selectedDeviceId && devices.length > 0) {
					const backCam = devices.find((device) =>
						device.label.toLowerCase().includes("back"),
					);
					const defaultId = backCam ? backCam.deviceId : devices[0]?.deviceId;
					setSelectedDeviceId(defaultId);
					setSelectedDeviceLabel(backCam ? backCam.label : devices[0]?.label);
				}

				setIsLoading(false);
			} catch (err) {
				// biome-ignore lint/suspicious/noConsole: error logging
				console.error("Scanner init error:", err);
				if (active) {
					setHasPermission(false);
					setIsLoading(false);
					toast.error("Failed to access camera. Please check permissions.");
				}
			}
		}

		void initScanner();

		return () => {
			active = false;
			stopScanning();
		};
	}, [isOpen, selectedDeviceId, onScanSuccess, handleClose, stopScanning]);

	// Switch camera device
	const handleDeviceChange = (deviceId: string) => {
		stopScanning();
		setIsLoading(true);
		setSelectedDeviceId(deviceId);
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="sm:max-w-[480px] p-6 overflow-hidden">
				<DialogHeader className="mb-4">
					<DialogTitle className="flex items-center gap-2 text-xl font-bold">
						<Camera className="h-5 w-5 text-emerald-500" />
						Scan Barcode / QR Code
					</DialogTitle>
					<DialogDescription>
						Align the code within the targeting overlay to scan automatically
					</DialogDescription>
				</DialogHeader>

				<div className="relative flex flex-col items-center justify-center bg-zinc-950 rounded-xl overflow-hidden aspect-video border border-zinc-800">
					{/* Video Feed */}
					<video
						ref={videoRef}
						className={`w-full h-full object-cover ${isMirrored ? "scale-x-[-1]" : ""}`}
						playsInline
						muted
					/>

					{/* Loading State Overlay */}
					{isLoading && (
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 text-white z-10">
							<Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
							<span className="text-sm font-medium">
								Accessing camera stream...
							</span>
						</div>
					)}

					{/* No Permission Overlay */}
					{hasPermission === false && (
						<div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3 bg-zinc-950 text-zinc-400 z-10">
							<p className="text-sm font-medium text-destructive">
								Camera permission denied or unavailable.
							</p>
							<p className="text-xs text-zinc-500">
								Please grant camera permissions in your browser settings to use
								the scanner.
							</p>
						</div>
					)}

					{/* Target Overlay (Futuristic HUD style) */}
					{!isLoading && hasPermission && (
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
							{/* Targeting Box */}
							<div className="relative w-64 h-36 border-2 border-emerald-500/30 rounded-lg">
								{/* Pulse Scanning Laser */}
								<div className="absolute left-0 w-full h-[2px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)] animate-bounce top-0" />

								{/* Corner Brackets */}
								<div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-500 rounded-tl-sm" />
								<div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-500 rounded-tr-sm" />
								<div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-500 rounded-bl-sm" />
								<div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-500 rounded-br-sm" />
							</div>
						</div>
					)}
				</div>

				{/* Device Selector / Footer */}
				<div className="mt-4 flex flex-col gap-3">
					{videoDevices.length > 1 && (
						<div className="flex items-center justify-between gap-3 text-xs">
							<span className="text-muted-foreground font-medium flex items-center gap-1">
								<RefreshCw className="h-3 w-3" />
								Active Camera:
							</span>
							<select
								value={selectedDeviceId}
								onChange={(e) => handleDeviceChange(e.target.value)}
								className="bg-background border border-input rounded-md px-2 py-1 text-sm font-medium max-w-[200px] truncate focus:outline-none focus:ring-1 focus:ring-ring"
							>
								{videoDevices.map((device) => (
									<option key={device.deviceId} value={device.deviceId}>
										{device.label ||
											`Camera ${videoDevices.indexOf(device) + 1}`}
									</option>
								))}
							</select>
						</div>
					)}

					{/* Manual Input Section */}
					<div className="border-t pt-4 mt-2 flex flex-col gap-2">
						<label
							htmlFor="manual-code-input"
							className="text-xs font-semibold text-muted-foreground"
						>
							Or Enter Manually
						</label>
						<div className="flex gap-2">
							<Input
								id="manual-code-input"
								type="text"
								placeholder="Enter barcode or QR code..."
								value={manualCode}
								onChange={(e) => setManualCode(e.target.value)}
								className="flex-1 focus-visible:ring-emerald-500"
								onKeyDown={(e) => {
									if (e.key === "Enter" && manualCode.trim()) {
										e.preventDefault();
										handleManualSubmit();
									}
								}}
							/>
							<Button
								type="button"
								onClick={handleManualSubmit}
								disabled={!manualCode.trim()}
								className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
							>
								Submit
							</Button>
						</div>
					</div>

					<div className="flex justify-end gap-2 mt-2">
						<Button variant="outline" size="sm" onClick={handleClose}>
							Cancel
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
