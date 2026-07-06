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

	// Load cameras and start scan
	React.useEffect(() => {
		if (!isOpen || !isBrowser) return;

		let active = true;

		async function initScanner() {
			try {
				// Request camera permission to trigger browser prompt and ensure device labels are populated
				if (navigator.mediaDevices?.getUserMedia) {
					const stream = await navigator.mediaDevices.getUserMedia({
						video: true,
					});
					// Stop tracks immediately so we don't lock the camera
					stream.getTracks().forEach((track) => {
						track.stop();
					});
				} else {
					throw new Error(
						"Camera API is not supported in this browser or context",
					);
				}

				// Import browser-only library dynamically inside hook to protect build
				const { BrowserMultiFormatReader } = await import("@zxing/browser");
				const codeReader = new BrowserMultiFormatReader();

				// Enumerate video devices
				const devices = await BrowserMultiFormatReader.listVideoInputDevices();
				if (!active) return;

				setVideoDevices(devices);
				setHasPermission(true);

				// Determine device to use (prefer back camera, or first available)
				let deviceIdToUse = selectedDeviceId;
				if (!deviceIdToUse && devices.length > 0) {
					// Look for back camera
					const backCam = devices.find((device) =>
						device.label.toLowerCase().includes("back"),
					);
					deviceIdToUse = backCam ? backCam.deviceId : devices[0]?.deviceId;
					setSelectedDeviceId(deviceIdToUse);
				}

				if (!deviceIdToUse) {
					toast.error("No camera devices found");
					setIsLoading(false);
					return;
				}

				// Ensure video element is ready
				if (!videoRef.current) {
					// Wait a tick for ref to bind
					await new Promise((resolve) => setTimeout(resolve, 50));
				}

				if (!videoRef.current || !active) return;

				setIsLoading(false);

				// Start decoding
				const controls = await codeReader.decodeFromVideoDevice(
					deviceIdToUse,
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

				if (active) {
					controlsRef.current = controls;
				} else {
					controls.stop();
				}
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
						className="w-full h-full object-cover scale-x-[-1]"
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
