"use client";

import { Camera, Loader2, RefreshCw, Zap } from "lucide-react";
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

interface ScannerControls {
	stop: () => void | Promise<void>;
}

interface ScannerResult {
	getText: () => string;
}

function isNamedError(error: unknown, name: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === name
	);
}

function getCameraErrorMessage(error: unknown): string {
	if (isNamedError(error, "NotAllowedError")) {
		return "Camera permission was denied. Allow camera access in your browser settings and try again.";
	}
	if (isNamedError(error, "NotFoundError")) {
		return "No camera is available on this device.";
	}
	if (isNamedError(error, "NotReadableError")) {
		return "The camera is unavailable or already in use by another application.";
	}
	if (isNamedError(error, "OverconstrainedError")) {
		return "The selected camera does not support the requested settings.";
	}
	return "Unable to start the camera. Check the device and browser permissions, then try again.";
}

/**
 * BarcodeScannerDialog — client-side camera modal for scanning barcodes and QR codes.
 *
 * Utilizes `@zxing/browser` for decoding and provides camera device selection and flashlight controls.
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
	const [cameraError, setCameraError] = React.useState<string | null>(null);
	const [hasTorch, setHasTorch] = React.useState(false);
	const [isTorchOn, setIsTorchOn] = React.useState(false);
	const controlsRef = React.useRef<ScannerControls | null>(null);
	const activeStreamRef = React.useRef<MediaStream | null>(null);
	const acceptedRef = React.useRef(false);
	const onCloseRef = React.useRef(onClose);
	const onScanSuccessRef = React.useRef(onScanSuccess);

	React.useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	React.useEffect(() => {
		onScanSuccessRef.current = onScanSuccess;
	}, [onScanSuccess]);

	// Toggle flashlight / torch on supported camera hardware
	const toggleTorch = React.useCallback(async () => {
		const currentVideo = videoRef.current;
		const stream =
			activeStreamRef.current ??
			(currentVideo?.srcObject as MediaStream | null | undefined);
		const track = stream?.getVideoTracks()[0];
		if (!track) return;

		const nextState = !isTorchOn;
		try {
			await track.applyConstraints({
				advanced: [
					{ torch: nextState },
				] as unknown as MediaTrackConstraintSet[],
			});
			setIsTorchOn(nextState);
		} catch (e) {
			// biome-ignore lint/suspicious/noConsole: error logging
			console.error("Error toggling torch:", e);
		}
	}, [isTorchOn]);

	// Stop any active scanning stream
	const stopScanning = React.useCallback(() => {
		setIsTorchOn(false);
		setHasTorch(false);
		const controls = controlsRef.current;
		controlsRef.current = null;
		if (controls) {
			try {
				void Promise.resolve(controls.stop()).catch((stopError: unknown) => {
					// biome-ignore lint/suspicious/noConsole: error logging
					console.error("Error stopping scanner controls:", stopError);
				});
			} catch (stopError) {
				// biome-ignore lint/suspicious/noConsole: error logging
				console.error("Error stopping scanner controls:", stopError);
			}
		}

		if (activeStreamRef.current) {
			for (const track of activeStreamRef.current.getTracks()) {
				track.stop();
			}
			activeStreamRef.current = null;
		}

		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}
	}, []);

	// Reset state and close modal
	const handleClose = React.useCallback(() => {
		stopScanning();
		setIsLoading(true);
		setManualCode("");
		setCameraError(null);
		onCloseRef.current();
	}, [stopScanning]);

	// Handle manually entered code submission
	const handleManualSubmit = React.useCallback(() => {
		if (manualCode.trim()) {
			acceptedRef.current = true;
			toast.success("Code entered successfully!");
			onScanSuccessRef.current(manualCode.trim());
			handleClose();
		}
	}, [manualCode, handleClose]);

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
		acceptedRef.current = false;
		setCameraError(null);
		setHasPermission(null);
		setIsLoading(true);

		async function initScanner() {
			try {
				// Import browser-only libraries dynamically inside hook to protect build
				const { BrowserMultiFormatReader } = await import("@zxing/browser");
				const {
					BarcodeFormat,
					ChecksumException,
					DecodeHintType,
					FormatException,
					NotFoundException,
				} = await import("@zxing/library");

				// Configure explicit barcode hints to eliminate format ambiguity & speed up frame decoding.
				// Restricting possible formats prevents multi-format false positives and reduces CPU load.
				// Enabling TRY_HARDER performs multi-row scanline decoding across 1D barcodes to fix
				// misidentification of left-half digit patterns.
				const hints = new Map();
				hints.set(DecodeHintType.POSSIBLE_FORMATS, [
					BarcodeFormat.QR_CODE,
					BarcodeFormat.EAN_13,
					BarcodeFormat.CODE_128,
					BarcodeFormat.CODE_39,
					BarcodeFormat.UPC_A,
					BarcodeFormat.UPC_E,
					BarcodeFormat.EAN_8,
					BarcodeFormat.ITF,
					BarcodeFormat.DATA_MATRIX,
					BarcodeFormat.PDF_417,
				]);
				hints.set(DecodeHintType.TRY_HARDER, true);

				const options = {
					delayBetweenScanAttempts: 80,
					delayBetweenScanSuccess: 500,
				};

				const codeReader = new BrowserMultiFormatReader(hints, options);

				// Ensure video element is ready
				if (!videoRef.current) {
					// Wait a tick for ref to bind
					await new Promise((resolve) => setTimeout(resolve, 50));
				}

				if (!videoRef.current || !active) return;

				// Prefer a high-resolution rear camera (720p ideal for fast binarization & sharp focus).
				const preferredVideoConstraints: MediaTrackConstraints = {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					...(selectedDeviceId
						? { deviceId: { exact: selectedDeviceId } }
						: { facingMode: { ideal: "environment" } }),
				};
				const constraints: MediaStreamConstraints = {
					video: preferredVideoConstraints,
				};

				const handleDecode = (
					result: ScannerResult | undefined,
					error: unknown,
					controls: ScannerControls,
				) => {
					if (!active || acceptedRef.current) return;

					if (result) {
						const code = result.getText();
						if (!code) return;

						acceptedRef.current = true;
						if (controlsRef.current === controls) {
							controlsRef.current = null;
						}
						try {
							void Promise.resolve(controls.stop()).catch(
								(stopError: unknown) => {
									// biome-ignore lint/suspicious/noConsole: error logging
									console.error("Error stopping scanner controls:", stopError);
								},
							);
						} catch (stopError) {
							// biome-ignore lint/suspicious/noConsole: error logging
							console.error("Error stopping scanner controls:", stopError);
						}
						toast.success("Code scanned successfully!");
						onScanSuccessRef.current(code);
						handleClose();
						return;
					}

					const isExpectedDecodeMiss =
						error instanceof NotFoundException ||
						error instanceof ChecksumException ||
						error instanceof FormatException;
					if (error && !isExpectedDecodeMiss) {
						const message = "Barcode scanning stopped unexpectedly. Try again.";
						acceptedRef.current = true;
						setHasPermission(false);
						setIsLoading(false);
						setCameraError(message);
						toast.error(message);
						try {
							void controls.stop();
						} catch {
							// The stream cleanup below remains the final fallback.
						}
					}
				};

				let controls: ScannerControls;
				try {
					controls = await codeReader.decodeFromConstraints(
						constraints,
						videoRef.current,
						handleDecode,
					);
				} catch (constraintsErr) {
					// Retry only when the requested camera settings cannot be satisfied.
					if (!active) return;
					if (isNamedError(constraintsErr, "OverconstrainedError")) {
						controls = await codeReader.decodeFromConstraints(
							{ video: true },
							videoRef.current,
							handleDecode,
						);
					} else {
						throw constraintsErr;
					}
				}

				if (!active || acceptedRef.current) {
					void controls.stop();
					return;
				}

				activeStreamRef.current = videoRef.current
					.srcObject as MediaStream | null;
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
				if (activeTrack && typeof activeTrack.getCapabilities === "function") {
					try {
						const caps = activeTrack.getCapabilities() as Record<
							string,
							unknown
						>;
						setHasTorch(Boolean(caps.torch));
					} catch {
						setHasTorch(false);
					}
				}

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
					const message = getCameraErrorMessage(err);
					setHasPermission(false);
					setIsLoading(false);
					setCameraError(message);
					toast.error(message);
				}
			}
		}

		void initScanner();

		return () => {
			active = false;
			stopScanning();
		};
	}, [isOpen, selectedDeviceId, handleClose, stopScanning]);

	// Switch camera device
	const handleDeviceChange = (deviceId: string) => {
		stopScanning();
		acceptedRef.current = false;
		setCameraError(null);
		setIsLoading(true);
		setSelectedDeviceId(deviceId);
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="sm:max-w-[480px] p-6 bg-background overflow-hidden">
				<DialogHeader className="mb-4">
					<DialogTitle className="flex items-center gap-2 text-xl font-bold">
						<Camera className="h-5 w-5 text-emerald-500" />
						Scan Barcode / QR Code
					</DialogTitle>
					<DialogDescription>
						Hold one barcode or QR code clearly in view to scan automatically
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
								Camera unavailable
							</p>
							<p className="text-xs text-zinc-500">
								{cameraError ??
									"Check your browser camera settings and try again."}
							</p>
						</div>
					)}

					{/* Target Overlay (Futuristic HUD style) */}
					{!isLoading && hasPermission && (
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
							{/* Targeting Box */}
							<div
								data-testid="barcode-scan-region"
								className="relative h-[50%] w-[60%] rounded-lg border-2 border-emerald-500/30"
							>
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

				{/* Device Selector & Controls / Footer */}
				<div className="mt-4 flex flex-col gap-3">
					{(videoDevices.length > 1 || hasTorch) && (
						<div className="flex items-center justify-between gap-3 text-xs">
							{videoDevices.length > 1 ? (
								<div className="flex items-center gap-2">
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
							) : (
								<div />
							)}

							{hasTorch && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									data-testid="torch-toggle-button"
									onClick={toggleTorch}
									className="flex items-center gap-1 text-xs"
								>
									<Zap
										className={`h-3.5 w-3.5 ${
											isTorchOn ? "text-amber-400 fill-amber-400" : ""
										}`}
									/>
									{isTorchOn ? "Torch On" : "Torch Off"}
								</Button>
							)}
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
