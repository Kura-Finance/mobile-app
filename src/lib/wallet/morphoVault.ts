/**
 * Morpho MetaMorpho / ERC-4626 vault reads and transaction builders.
 */
import { encodeFunctionData, erc20Abi, erc4626Abi, parseUnits } from 'viem';

import { getPublicClient, type SmartAccountCall } from './smartAccountClient';

export interface MorphoVaultAssetRef {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
}

export interface MorphoVaultOnChainPosition {
  shares: bigint;
  assets: bigint;
  assetsFormatted: number;
}

export interface MorphoWithdrawPlan {
  shares: bigint;
}

function amountToRaw(amount: number, decimals: number): bigint {
  const raw = amount.toString();
  const [whole, frac = ''] = raw.split('.');
  const safe = frac ? `${whole}.${frac.slice(0, decimals)}` : whole;
  return parseUnits(safe as `${number}`, decimals);
}

export async function readMorphoVaultPosition(
  vaultAddress: `0x${string}`,
  owner: `0x${string}`,
  assetDecimals: number,
): Promise<MorphoVaultOnChainPosition> {
  const client = getPublicClient();
  const shares = (await client.readContract({
    address: vaultAddress,
    abi: erc4626Abi,
    functionName: 'balanceOf',
    args: [owner],
  })) as bigint;

  if (shares <= 0n) {
    return { shares: 0n, assets: 0n, assetsFormatted: 0 };
  }

  const assets = (await client.readContract({
    address: vaultAddress,
    abi: erc4626Abi,
    functionName: 'convertToAssets',
    args: [shares],
  })) as bigint;

  const assetsFormatted = Number(assets) / 10 ** assetDecimals;
  return { shares, assets, assetsFormatted };
}

export async function readErc20Balance(
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
  decimals: number,
): Promise<number> {
  const raw = (await getPublicClient().readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
  })) as bigint;
  return Number(raw) / 10 ** decimals;
}

export function buildMorphoDepositTx(params: {
  vaultAddress: `0x${string}`;
  asset: MorphoVaultAssetRef;
  amount: number;
  receiver: `0x${string}`;
}): { assetsRaw: bigint; tx: SmartAccountCall } {
  const { vaultAddress, asset, amount, receiver } = params;
  const assetsRaw = amountToRaw(amount, asset.decimals);
  if (assetsRaw <= 0n) throw new Error('Amount must be greater than 0.');

  return {
    assetsRaw,
    tx: {
      to: vaultAddress,
      data: encodeFunctionData({
        abi: erc4626Abi,
        functionName: 'deposit',
        args: [assetsRaw, receiver],
      }),
    },
  };
}

/** @deprecated Prefer buildMorphoDepositTx + buildAllowanceAndTxCalls */
export function buildMorphoDepositCalls(params: {
  vaultAddress: `0x${string}`;
  asset: MorphoVaultAssetRef;
  amount: number;
  receiver: `0x${string}`;
}): SmartAccountCall[] {
  const { assetsRaw, tx } = buildMorphoDepositTx(params);
  const { vaultAddress, asset } = params;
  return [
    {
      to: asset.address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [vaultAddress, assetsRaw],
      }),
    },
    tx,
  ];
}

export async function planMorphoWithdraw(params: {
  vaultAddress: `0x${string}`;
  assetDecimals: number;
  owner: `0x${string}`;
  /** Withdraw all shares when true; otherwise withdraw up to this asset amount. */
  withdrawAll: boolean;
  amountAssets?: number;
}): Promise<MorphoWithdrawPlan> {
  const { vaultAddress, assetDecimals, owner, withdrawAll, amountAssets } = params;

  const position = await readMorphoVaultPosition(vaultAddress, owner, assetDecimals);
  if (position.shares <= 0n) {
    throw new Error('No vault shares to withdraw.');
  }

  let shares = position.shares;

  if (!withdrawAll) {
    if (!amountAssets || amountAssets <= 0) throw new Error('Amount must be greater than 0.');
    const targetRaw = amountToRaw(amountAssets, assetDecimals);
    if (targetRaw > position.assets) {
      throw new Error('Amount exceeds vault balance.');
    }
    shares = (await getPublicClient().readContract({
      address: vaultAddress,
      abi: erc4626Abi,
      functionName: 'convertToShares',
      args: [targetRaw],
    })) as bigint;
    if (shares > position.shares) shares = position.shares;
  }

  return { shares };
}

export function buildMorphoWithdrawCalls(params: {
  vaultAddress: `0x${string}`;
  owner: `0x${string}`;
  plan: MorphoWithdrawPlan;
}): SmartAccountCall[] {
  const { vaultAddress, owner, plan } = params;
  return [
    {
      to: vaultAddress,
      data: encodeFunctionData({
        abi: erc4626Abi,
        functionName: 'redeem',
        args: [plan.shares, owner, owner],
      }),
    },
  ];
}
