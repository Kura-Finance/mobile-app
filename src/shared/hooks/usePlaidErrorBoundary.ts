/**
 * Hook to handle Plaid SDK errors and system-level WebKit crashes
 * Provides error detection, logging, and recovery mechanisms
 */

import { useEffect, useRef } from 'react';
import Logger from '../utils/Logger';

interface PlaidCrashHandler {
  onCrashDetected?: (error: Error) => void;
  onWarning?: (message: string) => void;
}

export function usePlaidErrorBoundary(handlers: PlaidCrashHandler) {
  const exceptionHandlerRef = useRef<any>(null);

  useEffect(() => {
    // Listen for unhandled promise rejections
    const handleUnhandledRejection = (event: any) => {
      const error = event.reason || event.message;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if it's a Plaid-related error
      if (
        errorMsg.includes('Plaid') ||
        errorMsg.includes('WebKit') ||
        errorMsg.includes('ContentKey') ||
        errorMsg.includes('FairPlay')
      ) {
        Logger.error('PlaidErrorBoundary', 'Unhandled Plaid error detected', {
          error: errorMsg,
          original: error,
        });
        handlers.onCrashDetected?.(error instanceof Error ? error : new Error(errorMsg));
      }
    };

    // Listen for native module errors (if available)
    const handleNativeError = (error: any) => {
      const msg = error?.message || String(error);
      if (
        msg.includes('WebKit.GPU') ||
        msg.includes('AVContentKey') ||
        msg.includes('CDMInstance')
      ) {
        Logger.warn('PlaidErrorBoundary', 'System WebKit crash detected', { error: msg });
        handlers.onWarning?.('A system error occurred. Please try again.');
      }
    };

    // Add listeners
    const promiseRejectionHandler = (event: PromiseRejectionEvent) => {
      handleUnhandledRejection(event);
    };

    if (typeof globalThis !== 'undefined') {
      globalThis.addEventListener?.('unhandledrejection', promiseRejectionHandler);
    }

    return () => {
      if (typeof globalThis !== 'undefined') {
        globalThis.removeEventListener?.('unhandledrejection', promiseRejectionHandler);
      }
    };
  }, [handlers]);

  return {
    logPlaidEvent: (event: string, data?: any) => {
      Logger.debug('Plaid', event, data);
    },
    logPlaidError: (error: any) => {
      Logger.error('Plaid', 'SDK Error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    },
  };
}
