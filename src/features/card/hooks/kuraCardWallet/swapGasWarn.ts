import Logger from '../../../../shared/utils/Logger';

let lastSwapGasEstimateWarnAt = 0;
let lastSwapGasEstimateWarnMsg = '';

export function warnSwapGasEstimateThrottled(message: string): void {
  const now = Date.now();
  if (message === lastSwapGasEstimateWarnMsg && now - lastSwapGasEstimateWarnAt < 60_000) {
    return;
  }
  lastSwapGasEstimateWarnAt = now;
  lastSwapGasEstimateWarnMsg = message;
  Logger.warn('KuraCardWallet', 'Swap gas estimate failed; using fallback', { err: message });
}
