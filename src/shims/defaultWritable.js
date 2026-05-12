'use strict';
/**
 * Hermes "Cannot assign to property 'default' which has only a getter" fix
 * + diagnostic logging to find the offending module.
 *
 * Strategy:
 *   1. Patch Object.defineProperty so any getter-only `default` definition
 *      becomes a writable accessor (getter still works on read; first write
 *      overrides it).
 *   2. Install a global error handler that logs the original stack trace
 *      when this specific TypeError fires, so we can pinpoint the source.
 *
 * Must run BEFORE any other module is required.
 */
(function () {
  console.log('[defaultWritable] Installing Object.defineProperty patch');

  // ── Part 1: patch Object.defineProperty ───────────────────────────────
  var _orig = Object.defineProperty;
  if (!_orig.__kura_patched) {
    function patched(obj, prop, desc) {
      if (
        prop === 'default' &&
        desc !== null &&
        typeof desc === 'object' &&
        typeof desc.get === 'function' &&
        !desc.set
      ) {
        var _get = desc.get;
        var _override;
        var _hasOverride = false;
        return _orig.call(Object, obj, prop, {
          enumerable: desc.enumerable !== false,
          configurable: true,
          get: function () { return _hasOverride ? _override : _get.call(this); },
          set: function (v) { _hasOverride = true; _override = v; },
        });
      }
      return _orig.call(Object, obj, prop, desc);
    }
    patched.__kura_patched = true;
    Object.defineProperty = patched;
  }

  // ── Part 2: capture the offending stack trace ─────────────────────────
  // React Native exposes ErrorUtils for early error capture, well before the
  // React DevTools redbox is wired up.
  var ErrorUtils = global.ErrorUtils;
  if (ErrorUtils && typeof ErrorUtils.setGlobalHandler === 'function') {
    var prevHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler(function (error, isFatal) {
      if (
        error &&
        typeof error.message === 'string' &&
        error.message.indexOf("Cannot assign to property 'default'") !== -1
      ) {
        // Use console.error so the stack trace shows up in Metro logs.
        console.error('[defaultWritable] Caught getter-only default assignment:');
        console.error('[defaultWritable] message:', error.message);
        console.error('[defaultWritable] stack:', error.stack);
      }
      if (prevHandler) prevHandler(error, isFatal);
    });
  }
})();
