/**
 * Device fingerprinting utility.
 * Generates a stable fingerprint based on browser/device characteristics.
 * Not cryptographically perfect but enough to identify repeat offenders.
 */

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    canvas.width = 200;
    canvas.height = 50;

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Bellarus FP", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Bellarus FP", 4, 17);

    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext)) return "no-webgl";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "no-debug-info";

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "";
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
    return `${vendor}~${renderer}`;
  } catch {
    return "webgl-error";
  }
}

export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];

  // Screen properties
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  components.push(`${window.devicePixelRatio}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  components.push(navigator.language);
  components.push((navigator.languages || []).join(","));

  // Platform
  components.push(navigator.platform || "unknown");

  // Hardware concurrency
  components.push(String(navigator.hardwareConcurrency || 0));

  // Max touch points
  components.push(String(navigator.maxTouchPoints || 0));

  // Canvas fingerprint
  components.push(getCanvasFingerprint());

  // WebGL fingerprint
  components.push(getWebGLFingerprint());

  // Installed plugins count
  components.push(String(navigator.plugins?.length || 0));

  // Do not track
  components.push(String((navigator as any).doNotTrack || "unset"));

  // Session storage available
  try {
    sessionStorage.setItem("__fp_test", "1");
    sessionStorage.removeItem("__fp_test");
    components.push("ss:1");
  } catch {
    components.push("ss:0");
  }

  // IndexedDB available
  components.push(`idb:${!!window.indexedDB}`);

  const raw = components.join("|");
  const hash = await hashString(raw);

  // Cache it for the session
  try {
    sessionStorage.setItem("device_fp", hash);
  } catch { /* ignore */ }

  return hash;
}

export function getCachedFingerprint(): string | null {
  try {
    return sessionStorage.getItem("device_fp");
  } catch {
    return null;
  }
}
