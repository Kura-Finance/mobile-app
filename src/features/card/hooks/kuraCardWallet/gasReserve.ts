import { encodeFunctionData, erc20Abi } from 'viem';
import { base } from 'viem/chains';
import {
  GAS_RESERVE_BUFFER,
  GAS_RESERVE_FALLBACK_USDC,
  GAS_TOKEN,
  PAY_GAS_IN_USDC,
  USDC_BASE,
} from '../../config/cardWalletConfig';
import Logger from '../../../../shared/utils/Logger';
import { estimateErc20GasUsdc, withGasApprovalCalls } from '../../../../lib/wallet/smartAccountClient';
import type { ResolveSmartAccountClient } from './types';

export async function estimateUsdcGasReserve(
  resolveClient: ResolveSmartAccountClient,
  smartAddress: string,
): Promise<number> {
  if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
  try {
    const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();

    const calls = await withGasApprovalCalls(pimlicoClient, sca, [
      {
        to: USDC_BASE as `0x${string}`,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [sca, 0n] }),
      },
    ]);
    const userOperation = await client.prepareUserOperation({ calls });
    const { costInToken } = await pimlicoClient.estimateErc20PaymasterCost({
      userOperation,
      token: GAS_TOKEN as `0x${string}`,
      chain: base,
    });
    const reserve = (Number(costInToken) / 1_000_000) * GAS_RESERVE_BUFFER;
    return Math.max(reserve, 0.01);
  } catch (err) {
    Logger.warn('KuraCardWallet', 'Gas reserve estimate failed; using fallback', {
      err: err instanceof Error ? err.message : String(err),
    });
    return GAS_RESERVE_FALLBACK_USDC;
  }
}

export { estimateErc20GasUsdc };
