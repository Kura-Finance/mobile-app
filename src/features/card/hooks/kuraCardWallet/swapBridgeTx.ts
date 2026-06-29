import type { LiFiBridgeQuote } from '../../../../lib/api/bridge/lifiClient';
import type { SwapQuote } from '../../../../lib/api/bridge/lifiSwapClient';
import {
  GAS_RESERVE_FALLBACK_USDC,
  PAY_GAS_IN_USDC,
} from '../../config/cardWalletConfig';
import Logger from '../../../../shared/utils/Logger';
import { userFacingTransactionError } from '../../../../lib/wallet/userFacingTransactionError';
import { estimateErc20GasUsdc } from '../../../../lib/wallet/smartAccountClient';
import { buildAllowanceAndTxCalls, withGasApprovalCalls } from './sendTx';
import { warnSwapGasEstimateThrottled } from './swapGasWarn';
import type { ResolveSmartAccountClient } from './types';

function buildQuoteCalls(sca: `0x${string}`, quote: {
  approvalAddress: string;
  fromToken: { address: string };
  fromAmount: string;
  transactionRequest: { to: string; data: string; value?: string };
}) {
  return buildAllowanceAndTxCalls({
    spender: quote.approvalAddress as `0x${string}`,
    fromToken: quote.fromToken.address as `0x${string}`,
    fromAmount: BigInt(quote.fromAmount),
    scaAddress: sca,
    tx: {
      to: quote.transactionRequest.to as `0x${string}`,
      data: quote.transactionRequest.data as `0x${string}`,
      value: BigInt(quote.transactionRequest.value ?? '0'),
    },
  });
}

export async function executeBridgeTx(
  resolveClient: ResolveSmartAccountClient,
  quote: LiFiBridgeQuote,
): Promise<string> {
  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const callsRaw = await buildQuoteCalls(sca, quote);
  const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
  return (await client.sendTransaction({ calls })) as string;
}

export async function estimateBridgeGasUsdc(
  resolveClient: ResolveSmartAccountClient,
  smartAddress: string,
  quote: LiFiBridgeQuote,
): Promise<number> {
  if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
  try {
    const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
    const callsRaw = await buildQuoteCalls(sca, quote);
    const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
    return await estimateErc20GasUsdc(client, pimlicoClient, calls);
  } catch (err) {
    Logger.warn('KuraCardWallet', 'Bridge gas estimate failed; using fallback', {
      err: err instanceof Error ? err.message : String(err),
    });
    return GAS_RESERVE_FALLBACK_USDC;
  }
}

export async function executeSwapTx(
  resolveClient: ResolveSmartAccountClient,
  quote: SwapQuote,
): Promise<string> {
  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const callsRaw = await buildQuoteCalls(resolveClient, quote);
  const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
  try {
    return (await client.sendTransaction({ calls })) as string;
  } catch (err) {
    throw new Error(userFacingTransactionError(err));
  }
}

export async function estimateSwapGasUsdc(
  resolveClient: ResolveSmartAccountClient,
  smartAddress: string,
  quote: SwapQuote,
): Promise<number> {
  if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
  try {
    const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
    const callsRaw = await buildQuoteCalls(sca, quote);
    const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
    return await estimateErc20GasUsdc(client, pimlicoClient, calls);
  } catch (err) {
    warnSwapGasEstimateThrottled(
      userFacingTransactionError(err, 'crypto.swapSimulationFailed'),
    );
    return GAS_RESERVE_FALLBACK_USDC;
  }
}
