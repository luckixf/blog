const FINGERPRINT_KEY = "blog_fp";

async function sha256Hex(message: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function generateFingerprint(): Promise<string> {
	const components: string[] = [];

	components.push(navigator.userAgent || "");
	components.push(navigator.language || "");
	components.push((navigator.languages || []).join(","));
	components.push(`${screen.width}x${screen.height}`);
	components.push(`${screen.colorDepth}`);
	components.push(`${window.devicePixelRatio || 1}`);
	components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
	components.push(`${new Date().getTimezoneOffset()}`);

	const platform =
		(navigator as Navigator & {
			userAgentData?: { platform?: string };
		}).userAgentData?.platform ||
		navigator.platform ||
		"";
	components.push(platform);
	components.push(`${navigator.hardwareConcurrency || 0}`);
	components.push(`${navigator.maxTouchPoints || 0}`);

	try {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (context) {
			canvas.width = 200;
			canvas.height = 50;
			context.textBaseline = "top";
			context.font = "14px Arial";
			context.fillStyle = "#f60";
			context.fillRect(0, 0, 100, 30);
			context.fillStyle = "#069";
			context.fillText("fingerprint", 2, 15);
			context.fillStyle = "rgba(102, 204, 0, 0.7)";
			context.fillText("canvas", 4, 17);
			components.push(canvas.toDataURL().slice(-50));
		}
	} catch {
		components.push("canvas-error");
	}

	try {
		const canvas = document.createElement("canvas");
		const gl =
			canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
		if (gl && gl instanceof WebGLRenderingContext) {
			const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
			if (debugInfo) {
				components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "");
				components.push(
					gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "",
				);
			}
		}
	} catch {
		components.push("webgl-error");
	}

	return sha256Hex(components.join("|||"));
}

export async function getFingerprint(): Promise<string> {
	try {
		const cached = localStorage.getItem(FINGERPRINT_KEY);
		if (cached) {
			try {
				const { fp, ts } = JSON.parse(cached);
				const age = Date.now() - ts;
				const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
				if (
					fp &&
					typeof fp === "string" &&
					fp.length >= 8 &&
					age < THIRTY_DAYS
				) {
					return fp;
				}
			} catch {
				// ignore invalid cache
			}
		}

		const fingerprint = (await generateFingerprint()).slice(0, 32);
		localStorage.setItem(
			FINGERPRINT_KEY,
			JSON.stringify({ fp: fingerprint, ts: Date.now() }),
		);
		return fingerprint;
	} catch {
		const fallbackKey = "blog_fp_fallback";
		let fallback = localStorage.getItem(fallbackKey);
		if (!fallback) {
			fallback = Array.from(crypto.getRandomValues(new Uint8Array(16)))
				.map((byte) => byte.toString(16).padStart(2, "0"))
				.join("");
			localStorage.setItem(fallbackKey, fallback);
		}
		return fallback;
	}
}
