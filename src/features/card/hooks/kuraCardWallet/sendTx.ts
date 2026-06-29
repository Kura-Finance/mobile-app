import { USDC_BASE, WETH_BASE } from '../../config/cardWalletConfig';
import { buildAllowanceAndTxCalls, withGasApprovalCalls } from '../../../../lib/wallet/smartAccountClient';
import type { ResolveSmartAccountClient } from './types';

export async function sendUsdcTx(
  resolveClient: ResolveSmartAccountClient,
  toAddress: string,
  amountUsdc: number,
  usdcBalance: number,
): Promise<string> {
  const { encodeFunctionData, erc20Abi, isAddress } = require('viem') as typeof import('viem');
  if (!isAddress(toAddress)) throw new Error('Invalid Ethereum address.');
  if (amountUsdc <= 0) throw new Error('Amount must be greater than 0.');
  if (amountUsdc > usdcBalance) throw new Error('Insufficient USDC balance.');

  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const calls = await withGasApprovalCalls(pimlicoClient, sca, [
    {
      to: USDC_BASE as `0x${string}`,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddress as `0x${string}`, BigInt(Math.round(amountUsdc * 1_000_000))],
      }),
    },
  ]);
  return (await client.sendTransaction({ calls })) as string;
}

export async function sendTokenTx(
  resolveClient: ResolveSmartAccountClient,
  tokenAddress: `0x${string}`,
  decimals: number,
  toAddress: string,
  amount: number,
): Promise<string> {
  const { encodeFunctionData, erc20Abi, isAddress, parseUnits } =
    require('viem') as typeof import('viem');
  if (!isAddress(toAddress)) throw new Error('Invalid Ethereum address.');
  if (amount <= 0) throw new Error('Amount must be greater than 0.');

  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const raw = amount.toString();
  const [whole, frac = ''] = raw.split('.');
  const safe = frac ? `${whole}.${frac.slice(0, decimals)}` : whole;
  const amountWei = parseUnits(safe as `${number}`, decimals);
  const calls = await withGasApprovalCalls(pimlicoClient, sca, [
    {
      to: tokenAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddress as `0x${string}`, amountWei],
      }),
    },
  ]);
  return (await client.sendTransaction({ calls })) as string;
}

export async function sendNativeEthTx(
  resolveClient: ResolveSmartAccountClient,
  toAddress: string,
  amountEth: number,
): Promise<string> {
  const { isAddress, parseUnits } = require('viem') as typeof import('viem');
  if (!isAddress(toAddress)) throw new Error('Invalid Ethereum address.');
  if (amountEth <= 0) throw new Error('Amount must be greater than 0.');

  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const raw = amountEth.toString();
  const [whole, frac = ''] = raw.split('.');
  const safe = frac ? `${whole}.${frac.slice(0, 18)}` : whole;
  const amountWei = parseUnits(safe as `${number}`, 18);
  const calls = await withGasApprovalCalls(pimlicoClient, sca, [
    { to: toAddress as `0x${string}`, value: amountWei, data: '0x' },
  ]);
  return (await client.sendTransaction({ calls })) as string;
}

export async function wrapEthToWethTx(
  resolveClient: ResolveSmartAccountClient,
  amountEth: number,
): Promise<string> {
  if (amountEth <= 0) throw new Error('Amount must be greater than 0.');

  const { encodeFunctionData, parseUnits } = require('viem') as typeof import('viem');
  const wethAbi = [
    {
      type: 'function',
      name: 'deposit',
      inputs: [],
      outputs: [],
      stateMutability: 'payable',
    },
  ] as const;
  const raw = amountEth.toString();
  const [whole, frac = ''] = raw.split('.');
  const safe = frac ? `${whole}.${frac.slice(0, 18)}` : whole;
  const amountWei = parseUnits(safe as `${number}`, 18);
  const { smartAccountClient: client, smartAddress: sca, pimlicoClient } = await resolveClient();
  const calls = await withGasApprovalCalls(pimlicoClient, sca, [
    {
      to: WETH_BASE as `0x${string}`,
      value: amountWei,
      data: encodeFunctionData({ abi: wethAbi, functionName: 'deposit' }),
    },
  ]);
  return (await client.sendTransaction({ calls })) as string;
}

export { buildAllowanceAndTxCalls, withGasApprovalCalls };
