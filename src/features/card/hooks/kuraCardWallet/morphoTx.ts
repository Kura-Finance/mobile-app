import {
  GAS_RESERVE_FALLBACK_USDC,
  PAY_GAS_IN_USDC,
} from '../../config/cardWalletConfig';
import Logger from '../../../../shared/utils/Logger';
import { estimateErc20GasUsdc } from '../../../../lib/wallet/smartAccountClient';
import { buildAllowanceAndTxCalls, withGasApprovalCalls } from './sendTx';
import type {
  MorphoBorrowTxParams,
  MorphoEarnVaultParams,
  MorphoEarnWithdrawParams,
  MorphoRepayTxParams,
  MorphoWithdrawCollateralTxParams,
  ResolveSmartAccountClient,
} from './types';

export async function executeMorphoDepositTx(
  resolveClient: ResolveSmartAccountClient,
  params: MorphoEarnVaultParams & { amount: number },
): Promise<string> {
  const { buildMorphoDepositTx } =
    require('../../../../lib/wallet/morphoVault') as typeof import('../../../../lib/wallet/morphoVault');
  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const { assetsRaw, tx } = buildMorphoDepositTx({
    vaultAddress: params.depositVaultAddress,
    asset: params.asset,
    amount: params.amount,
    receiver: sca,
  });
  const callsRaw = await buildAllowanceAndTxCalls({
    spender: params.depositVaultAddress,
    fromToken: params.asset.address,
    fromAmount: assetsRaw,
    scaAddress: sca,
    tx,
  });
  const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
  return (await client.sendTransaction({ calls })) as string;
}

export async function executeMorphoWithdrawTx(
  resolveClient: ResolveSmartAccountClient,
  params: MorphoEarnWithdrawParams,
): Promise<string> {
  const { planMorphoWithdraw, buildMorphoWithdrawCalls } =
    require('../../../../lib/wallet/morphoVault') as typeof import('../../../../lib/wallet/morphoVault');
  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const plan = await planMorphoWithdraw({
    vaultAddress: params.depositVaultAddress,
    assetDecimals: params.asset.decimals,
    owner: sca,
    withdrawAll: params.withdrawAll,
    amountAssets: params.amountAssets,
  });
  const callsRaw = buildMorphoWithdrawCalls({
    vaultAddress: params.depositVaultAddress,
    owner: sca,
    plan,
  });
  const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
  return (await client.sendTransaction({ calls })) as string;
}

export async function estimateMorphoDepositGasUsdc(
  resolveClient: ResolveSmartAccountClient,
  smartAddress: string,
  params: MorphoEarnVaultParams & { amount: number },
): Promise<number> {
  if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
  try {
    const { buildMorphoDepositTx } =
      require('../../../../lib/wallet/morphoVault') as typeof import('../../../../lib/wallet/morphoVault');
    const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
    const { assetsRaw, tx } = buildMorphoDepositTx({
      vaultAddress: params.depositVaultAddress,
      asset: params.asset,
      amount: params.amount,
      receiver: sca,
    });
    const callsRaw = await buildAllowanceAndTxCalls({
      spender: params.depositVaultAddress,
      fromToken: params.asset.address,
      fromAmount: assetsRaw,
      scaAddress: sca,
      tx,
    });
    const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
    return await estimateErc20GasUsdc(client, pimlicoClient, calls);
  } catch (err) {
    Logger.warn('KuraCardWallet', 'Morpho deposit gas estimate failed; using fallback', {
      err: err instanceof Error ? err.message : String(err),
    });
    return GAS_RESERVE_FALLBACK_USDC;
  }
}

export async function estimateMorphoWithdrawGasUsdc(
  resolveClient: ResolveSmartAccountClient,
  smartAddress: string,
  params: MorphoEarnWithdrawParams,
): Promise<number> {
  if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
  try {
    const { planMorphoWithdraw, buildMorphoWithdrawCalls } =
      require('../../../../lib/wallet/morphoVault') as typeof import('../../../../lib/wallet/morphoVault');
    const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
    const plan = await planMorphoWithdraw({
      vaultAddress: params.depositVaultAddress,
      assetDecimals: params.asset.decimals,
      owner: sca,
      withdrawAll: params.withdrawAll,
      amountAssets: params.amountAssets,
    });
    const callsRaw = buildMorphoWithdrawCalls({
      vaultAddress: params.depositVaultAddress,
      owner: sca,
      plan,
    });
    const calls = await withGasApprovalCalls(pimlicoClient, sca, callsRaw);
    return await estimateErc20GasUsdc(client, pimlicoClient, calls);
  } catch (err) {
    Logger.warn('KuraCardWallet', 'Morpho withdraw gas estimate failed; using fallback', {
      err: err instanceof Error ? err.message : String(err),
    });
    return GAS_RESERVE_FALLBACK_USDC;
  }
}

export async function executeMorphoBorrowTx(
  resolveClient: ResolveSmartAccountClient,
  params: MorphoBorrowTxParams,
): Promise<string> {
  const { buildMorphoBorrowCalls, toMorphoMarketParams } =
    require('../../../../lib/wallet/morphoBlue') as typeof import('../../../../lib/wallet/morphoBlue');
  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const market = toMorphoMarketParams(params.market);
  const { calls } = await buildMorphoBorrowCalls({
    market,
    collateralAmount: params.collateralAmount,
    borrowAmount: params.borrowAmount,
    onBehalf: sca,
  });
  const callsWithGas = await withGasApprovalCalls(pimlicoClient, sca, calls);
  return (await client.sendTransaction({ calls: callsWithGas })) as string;
}

export async function executeMorphoRepayTx(
  resolveClient: ResolveSmartAccountClient,
  params: MorphoRepayTxParams,
): Promise<string> {
  const { buildMorphoRepayCalls, toMorphoMarketParams } =
    require('../../../../lib/wallet/morphoBlue') as typeof import('../../../../lib/wallet/morphoBlue');
  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const market = toMorphoMarketParams(params.market);
  const { calls } = await buildMorphoRepayCalls({
    market,
    repayAmount: params.repayAmount,
    repayAll: params.repayAll,
    onBehalf: sca,
  });
  const callsWithGas = await withGasApprovalCalls(pimlicoClient, sca, calls);
  return (await client.sendTransaction({ calls: callsWithGas })) as string;
}

export async function estimateMorphoBorrowGasUsdc(
  resolveClient: ResolveSmartAccountClient,
  smartAddress: string,
  params: MorphoBorrowTxParams,
): Promise<number> {
  if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
  try {
    const { buildMorphoBorrowCalls, toMorphoMarketParams } =
      require('../../../../lib/wallet/morphoBlue') as typeof import('../../../../lib/wallet/morphoBlue');
    const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
    const market = toMorphoMarketParams(params.market);
    const { calls } = await buildMorphoBorrowCalls({
      market,
      collateralAmount: params.collateralAmount,
      borrowAmount: params.borrowAmount,
      onBehalf: sca,
    });
    const callsWithGas = await withGasApprovalCalls(pimlicoClient, sca, calls);
    return await estimateErc20GasUsdc(client, pimlicoClient, callsWithGas);
  } catch (err) {
    Logger.warn('KuraCardWallet', 'Morpho borrow gas estimate failed; using fallback', {
      err: err instanceof Error ? err.message : String(err),
    });
    return GAS_RESERVE_FALLBACK_USDC;
  }
}

export async function estimateMorphoRepayGasUsdc(
  resolveClient: ResolveSmartAccountClient,
  smartAddress: string,
  params: MorphoRepayTxParams,
): Promise<number> {
  if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
  try {
    const { buildMorphoRepayCalls, toMorphoMarketParams } =
      require('../../../../lib/wallet/morphoBlue') as typeof import('../../../../lib/wallet/morphoBlue');
    const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
    const market = toMorphoMarketParams(params.market);
    const { calls } = await buildMorphoRepayCalls({
      market,
      repayAmount: params.repayAmount,
      repayAll: params.repayAll,
      onBehalf: sca,
    });
    const callsWithGas = await withGasApprovalCalls(pimlicoClient, sca, calls);
    return await estimateErc20GasUsdc(client, pimlicoClient, callsWithGas);
  } catch (err) {
    Logger.warn('KuraCardWallet', 'Morpho repay gas estimate failed; using fallback', {
      err: err instanceof Error ? err.message : String(err),
    });
    return GAS_RESERVE_FALLBACK_USDC;
  }
}

export async function executeMorphoWithdrawCollateralTx(
  resolveClient: ResolveSmartAccountClient,
  params: MorphoWithdrawCollateralTxParams,
): Promise<string> {
  const { buildMorphoWithdrawCollateralCalls, toMorphoMarketParams } =
    require('../../../../lib/wallet/morphoBlue') as typeof import('../../../../lib/wallet/morphoBlue');
  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const market = toMorphoMarketParams(params.market);
  const { calls } = await buildMorphoWithdrawCollateralCalls({
    market,
    withdrawAmount: params.withdrawAmount,
    onBehalf: sca,
    receiver: sca,
  });
  const callsWithGas = await withGasApprovalCalls(pimlicoClient, sca, calls);
  return (await client.sendTransaction({ calls: callsWithGas })) as string;
}

export async function estimateMorphoWithdrawCollateralGasUsdc(
  resolveClient: ResolveSmartAccountClient,
  smartAddress: string,
  params: MorphoWithdrawCollateralTxParams,
): Promise<number> {
  if (!PAY_GAS_IN_USDC || !smartAddress) return 0;
  try {
    const { buildMorphoWithdrawCollateralCalls, toMorphoMarketParams } =
      require('../../../../lib/wallet/morphoBlue') as typeof import('../../../../lib/wallet/morphoBlue');
    const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
    const market = toMorphoMarketParams(params.market);
    const { calls } = await buildMorphoWithdrawCollateralCalls({
      market,
      withdrawAmount: params.withdrawAmount,
      onBehalf: sca,
      receiver: sca,
    });
    const callsWithGas = await withGasApprovalCalls(pimlicoClient, sca, calls);
    return await estimateErc20GasUsdc(client, pimlicoClient, callsWithGas);
  } catch (err) {
    Logger.warn('KuraCardWallet', 'Morpho withdraw collateral gas estimate failed; using fallback', {
      err: err instanceof Error ? err.message : String(err),
    });
    return GAS_RESERVE_FALLBACK_USDC;
  }
}
