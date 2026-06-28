/**
 * Maps on-chain / wallet errors to short, UI-safe messages.
 * Strips huge callData / hex payloads that would overflow error banners.
 */
import i18n from '../../shared/locales/i18n';
import { PAY_GAS_IN_USDC } from '../../features/card/config/cardWalletConfig';

const MAX_DISPLAY_LENGTH = 240;
const LONG_HEX = /0x[0-9a-fA-F]{32,}/i;

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function stripLongHex(text: string): string {
  return text.replace(/0x[0-9a-fA-F]{20,}/gi, '0x…');
}

function isTechnicalDump(message: string): boolean {
  if (message.length > MAX_DISPLAY_LENGTH) return true;
  if (/callData\s*:/i.test(message)) return true;
  if (/Request Argument Error/i.test(message) && LONG_HEX.test(message)) return true;
  if (/userOperation/i.test(message) && LONG_HEX.test(message)) return true;
  if (/"data"\s*:\s*"0x[0-9a-fA-F]{32,}"/i.test(message)) return true;
  return false;
}

function mapKnownTransactionError(message: string): string | null {
  if (/transfer amount exceeds balance|ERC20:/i.test(message)) {
    return PAY_GAS_IN_USDC
      ? i18n.t('crypto.insufficientUsdcForTxAndGas')
      : i18n.t('crypto.insufficientTokenBalance');
  }
  if (/Insufficient USDC balance\./i.test(message)) {
    return message.length <= MAX_DISPLAY_LENGTH ? message : i18n.t('crypto.insufficientUsdcForTxAndGas');
  }
  if (/user rejected|User denied|ACTION_REJECTED|request rejected/i.test(message)) {
    return i18n.t('crypto.transactionRejected');
  }
  if (/Wallet not ready/i.test(message)) {
    return i18n.t('card.walletNotReady');
  }
  if (/Invalid Ethereum address|Address .* is invalid/i.test(message)) {
    return i18n.t('crypto.invalidAddress');
  }
  if (/Amount must be greater than 0/i.test(message)) {
    return i18n.t('crypto.amountMustBePositive');
  }
  if (/network|fetch failed|failed to fetch|ECONNREFUSED|timeout/i.test(message)) {
    return i18n.t('errors.networkError');
  }
  if (/quote failed|no route|cannot find route|LIQUIDITY/i.test(message)) {
    return i18n.t('crypto.quoteFailed');
  }
  if (/0xe52970aa|InsufficientAmountOut|Return amount is not enough/i.test(message)) {
    return i18n.t('crypto.swapOutputTooLow');
  }
  if (/reverted during simulation|UserOperation reverted/i.test(message)) {
    return i18n.t('crypto.swapSimulationFailed');
  }
  if (/rate limit exceeded/i.test(message)) {
    return i18n.t('trackfi.rateLimitError');
  }
  return null;
}

function headlineBeforeBlob(message: string): string | null {
  const line = message.split('\n').find((part) => part.trim())?.trim() ?? '';
  if (!line || line.length > 120 || LONG_HEX.test(line)) return null;
  const cleaned = line.replace(/:\s*$/, '').trim();
  return cleaned.length >= 4 ? cleaned : null;
}

/** Sanitize an already-rendered error string for display. */
export function formatDisplayError(
  message: string,
  fallbackKey = 'crypto.transactionFailed',
): string {
  const trimmed = message.trim();
  if (!trimmed) return i18n.t(fallbackKey);

  const mapped = mapKnownTransactionError(trimmed);
  if (mapped) return mapped;

  if (isTechnicalDump(trimmed)) {
    const headline = headlineBeforeBlob(trimmed);
    if (headline && !/Request Argument Error/i.test(headline)) {
      return i18n.t('crypto.transactionFailedWithReason', { reason: headline });
    }
    return i18n.t(fallbackKey);
  }

  const cleaned = stripLongHex(trimmed);
  if (cleaned.length > MAX_DISPLAY_LENGTH) {
    return `${cleaned.slice(0, MAX_DISPLAY_LENGTH - 1)}…`;
  }
  return cleaned;
}

/** Map a thrown value to a user-facing transaction error message. */
export function userFacingTransactionError(
  error: unknown,
  fallbackKey = 'crypto.transactionFailed',
): string {
  return formatDisplayError(extractErrorMessage(error), fallbackKey);
}
