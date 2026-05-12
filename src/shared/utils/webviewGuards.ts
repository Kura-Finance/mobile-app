/**
 * Shared hardening for in-app WebViews (KYC / payment providers).
 *
 * The iOS Simulator does NOT implement FairPlay / hardware DRM. When a web page
 * probes for Encrypted Media Extensions (EME) — e.g. an embedded promo/HLS video
 * that requests a FairPlay key system — WebKit tries to create an
 * `AVContentKeySession`, which throws and aborts the shared `com.apple.WebKit.GPU`
 * process. That GPU process is shared by every WKWebView in the app, so the crash
 * can cascade and break unrelated WebViews (e.g. Plaid Link), leaving flows stuck.
 *
 * This stubs `navigator.requestMediaKeySystemAccess` so EME probes reject cleanly
 * (pages fall back to non-DRM or simply skip the video) instead of crashing.
 *
 * IMPORTANT: This only disables DRM playback. It does NOT touch `getUserMedia`
 * (camera/mic), so KYC liveness / document capture keeps working.
 *
 * Runs before page content loads via `injectedJavaScriptBeforeContentLoaded`.
 */
export const DISABLE_EME_JS = `
(function () {
  try {
    if (navigator && navigator.requestMediaKeySystemAccess) {
      navigator.requestMediaKeySystemAccess = function () {
        return Promise.reject(
          new DOMException('EME disabled in app WebView', 'NotSupportedError')
        );
      };
    }
  } catch (e) {}
  true;
})();
true;
`;
