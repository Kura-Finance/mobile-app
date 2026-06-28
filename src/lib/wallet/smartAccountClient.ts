/**
 * Shared Safe SCA client builders used by Kura Card and WalletConnect wallet mode.
 */

import * as SecureStore from 'expo-secure-store';
import {
  assertPimlicoConfigured,
  createBaseTransport,
  GAS_RESERVE_BUFFER,
  GAS_RESERVE_FALLBACK_USDC,
  GAS_TOKEN,
  PAY_GAS_IN_USDC,
  PIMLICO_URL,
  USDC_BASE,
  WETH_BASE,
  WALLET_IMPORTED_KEY,
} from '../../features/card/config/cardWalletConfig';

import { userFacingTransactionError } from './userFacingTransactionError';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyClient = any;

export type ImportMnemonicType = 'bip44' | 'kura';

export interface TypedDataInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  domain: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  types: Record<string, any>;
  primaryType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: Record<string, any>;
}

export interface SmartAccountBundle {
  smartAccountClient: AnyClient;
  smartAddress: `0x${string}`;
  pimlicoClient: AnyClient;
}

/** A single ERC-4337 execution within a UserOperation. */
export type SmartAccountCall = { to: `0x${string}`; data: `0x${string}`; value?: bigint };

let _publicClient: AnyClient | null = null;

export function getPublicClient(): AnyClient {
  if (!_publicClient) {
    const { createPublicClient } = require('viem') as typeof import('viem');
    const { base } = require('viem/chains') as typeof import('viem/chains');
    _publicClient = createPublicClient({ chain: base, transport: createBaseTransport() });
  }
  return _publicClient;
}

function getEntryPoint() {
  const { entryPoint07Address } = require('viem/account-abstraction') as typeof import('viem/account-abstraction');
  return { address: entryPoint07Address, version: '0.7' } as const;
}

export function privateKeyFromMnemonic(phrase: string, type: ImportMnemonicType): string {
  const { Mnemonic, HDNodeWallet } = require('ethers') as typeof import('ethers');
  const cleaned = phrase.trim().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(cleaned)) {
    throw new Error('Invalid mnemonic — please check every word and try again.');
  }
  if (type === 'kura') {
    const entropy = Mnemonic.phraseToEntropy(cleaned) as string;
    return entropy.replace(/^0x/, '');
  }
  const root = HDNodeWallet.fromPhrase(cleaned);
  const account = root.derivePath("m/44'/60'/0'/0/0");
  return (account.privateKey as string).replace(/^0x/, '');
}

async function buildSmartAccountClientFromProvider(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eip1193Provider: any,
): Promise<SmartAccountBundle> {
  assertPimlicoConfigured();
  const { http, createWalletClient, custom } = require('viem') as typeof import('viem');
  const { base } = require('viem/chains') as typeof import('viem/chains');
  const { toSafeSmartAccount } = require('permissionless/accounts') as typeof import('permissionless/accounts');
  const { createSmartAccountClient } = require('permissionless') as typeof import('permissionless');
  const { createPimlicoClient } = require('permissionless/clients/pimlico') as typeof import('permissionless/clients/pimlico');

  const entryPoint = getEntryPoint();
  const publicClient = getPublicClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts: string[] = await (eip1193Provider as any).request({ method: 'eth_accounts' });
  const eoaAddress = accounts[0] as `0x${string}`;

  const ownerWalletClient = createWalletClient({
    account: eoaAddress,
    chain: base,
    transport: custom(eip1193Provider),
  });

  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [ownerWalletClient],
    entryPoint,
    version: '1.4.1',
  });

  const pimlicoClient = createPimlicoClient({ transport: http(PIMLICO_URL), entryPoint });

  return {
    smartAccountClient: createSmartAccountClient({
      account,
      chain: base,
      bundlerTransport: http(PIMLICO_URL),
      paymaster: pimlicoClient,
      ...(PAY_GAS_IN_USDC ? { paymasterContext: { token: GAS_TOKEN } } : {}),
      userOperation: {
        estimateFeesPerGas: async () =>
          (await pimlicoClient.getUserOperationGasPrice()).fast,
      },
    }),
    smartAddress: account.address as `0x${string}`,
    pimlicoClient,
  };
}

export async function buildSmartAccountClientFromPrivKey(ethPrivKey: string): Promise<SmartAccountBundle> {
  assertPimlicoConfigured();
  const { http } = require('viem') as typeof import('viem');
  const { base } = require('viem/chains') as typeof import('viem/chains');
  const { privateKeyToAccount } = require('viem/accounts') as typeof import('viem/accounts');
  const { toSafeSmartAccount } = require('permissionless/accounts') as typeof import('permissionless/accounts');
  const { createSmartAccountClient } = require('permissionless') as typeof import('permissionless');
  const { createPimlicoClient } = require('permissionless/clients/pimlico') as typeof import('permissionless/clients/pimlico');

  const entryPoint = getEntryPoint();
  const owner = privateKeyToAccount(`0x${ethPrivKey}` as `0x${string}`);

  const account = await toSafeSmartAccount({
    client: getPublicClient(),
    owners: [owner],
    entryPoint,
    version: '1.4.1',
  });

  const pimlicoClient = createPimlicoClient({ transport: http(PIMLICO_URL), entryPoint });

  return {
    smartAccountClient: createSmartAccountClient({
      account,
      chain: base,
      bundlerTransport: http(PIMLICO_URL),
      paymaster: pimlicoClient,
      ...(PAY_GAS_IN_USDC ? { paymasterContext: { token: GAS_TOKEN } } : {}),
      userOperation: {
        estimateFeesPerGas: async () =>
          (await pimlicoClient.getUserOperationGasPrice()).fast,
      },
    }),
    smartAddress: account.address as `0x${string}`,
    pimlicoClient,
  };
}

/** @deprecated Use buildSmartAccountClientFromPrivKey */
export const buildSmartAccountClient = buildSmartAccountClientFromPrivKey;

export async function resolveKuraSmartAccountClient(
  getEmbeddedProvider: () => Promise<unknown>,
): Promise<SmartAccountBundle> {
  const imported = await SecureStore.getItemAsync(WALLET_IMPORTED_KEY);
  if (imported) {
    return buildSmartAccountClientFromPrivKey(imported);
  }
  const provider = await getEmbeddedProvider();
  return buildSmartAccountClientFromProvider(provider);
}

export async function fetchTokenBalanceHuman(
  token: `0x${string}`,
  holder: `0x${string}`,
  decimals: number,
): Promise<number> {
  const { erc20Abi, formatUnits } = require('viem') as typeof import('viem');
  const raw = (await getPublicClient().readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [holder],
  })) as bigint;
  return parseFloat(formatUnits(raw, decimals));
}

export async function fetchWalletBalances(address: `0x${string}`): Promise<{ usdc: number; weth: number }> {
  const [usdc, weth] = await Promise.all([
    fetchTokenBalanceHuman(USDC_BASE as `0x${string}`, address, 6),
    fetchTokenBalanceHuman(WETH_BASE as `0x${string}`, address, 18),
  ]);
  return { usdc, weth };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Poll balances after a UserOp — RPC state can lag behind the bundler receipt. */
export async function refreshWalletBalancesAfterTx(
  address: `0x${string}`,
  onUpdate?: (balances: { usdc: number; weth: number }) => void,
): Promise<{ usdc: number; weth: number }> {
  const delaysMs = [0, 1200, 3000, 6000];
  let balances = { usdc: 0, weth: 0 };

  for (let i = 0; i < delaysMs.length; i++) {
    if (i > 0) await sleep(delaysMs[i] - delaysMs[i - 1]);
    try {
      balances = await fetchWalletBalances(address);
      onUpdate?.(balances);
    } catch {
      // Best-effort — keep polling.
    }
  }

  return balances;
}

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function withGasApprovalCalls(
  pimlicoClient: AnyClient,
  scaAddress: `0x${string}`,
  calls: SmartAccountCall[],
): Promise<SmartAccountCall[]> {
  if (!PAY_GAS_IN_USDC) return calls;

  const { encodeFunctionData, erc20Abi, maxUint256 } = require('viem') as typeof import('viem');
  const { base } = require('viem/chains') as typeof import('viem/chains');

  const quotes = await pimlicoClient.getTokenQuotes({ tokens: [GAS_TOKEN], chain: base });
  const paymaster = quotes[0]?.paymaster as `0x${string}` | undefined;
  if (!paymaster) throw new Error('Pimlico ERC-20 paymaster is unavailable for USDC on Base.');

  const allowance = (await getPublicClient().readContract({
    address: GAS_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [scaAddress, paymaster],
  })) as bigint;

  if (allowance > maxUint256 / 2n) return calls;

  return [
    {
      to: GAS_TOKEN as `0x${string}`,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [paymaster, maxUint256] }),
    },
    ...calls,
  ];
}

/** Sum explicit USDC `transfer` amounts in a UserOp batch (router swaps may omit this). */
export function sumUsdcTransferOutflow(calls: SmartAccountCall[]): bigint {
  const { decodeFunctionData, erc20Abi } = require('viem') as typeof import('viem');
  let total = 0n;

  for (const call of calls) {
    if (call.to.toLowerCase() !== USDC_BASE.toLowerCase()) continue;
    try {
      const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data });
      if (decoded.functionName === 'transfer') {
        total += decoded.args[1] as bigint;
      }
    } catch {
      // Not a standard ERC-20 transfer — ignore.
    }
  }

  return total;
}

function insufficientUsdcError(balanceRaw: bigint, outflowRaw: bigint, gasReserveRaw: bigint): Error {
  const balance = Number(balanceRaw) / 1_000_000;
  const needed = Number(outflowRaw + gasReserveRaw) / 1_000_000;
  const gas = Number(gasReserveRaw) / 1_000_000;
  return new Error(
    `Insufficient USDC balance. Balance: ${balance.toFixed(4)} USDC, needed: ~${needed.toFixed(4)} USDC (including ~${gas.toFixed(4)} USDC for network fees). Leave extra USDC for gas when paying fees in USDC.`,
  );
}

export function formatScaTransactionError(err: unknown): string {
  return userFacingTransactionError(err, 'crypto.transactionFailed');
}

async function estimateUsdcGasReserveForCalls(
  client: AnyClient,
  pimlicoClient: AnyClient,
  calls: SmartAccountCall[],
): Promise<bigint> {
  try {
    const gasUsdc = await estimateErc20GasUsdc(client, pimlicoClient, calls);
    const buffered = gasUsdc * GAS_RESERVE_BUFFER;
    return BigInt(Math.ceil(Math.max(buffered, 0.01) * 1_000_000));
  } catch {
    return BigInt(Math.ceil(GAS_RESERVE_FALLBACK_USDC * 1_000_000));
  }
}

/** Ensure the SCA can cover explicit USDC outflows plus ERC-20 paymaster gas. */
export async function assertSufficientUsdcForUserOp(
  scaAddress: `0x${string}`,
  client: AnyClient,
  pimlicoClient: AnyClient,
  calls: SmartAccountCall[],
): Promise<void> {
  if (!PAY_GAS_IN_USDC) return;

  const { erc20Abi } = require('viem') as typeof import('viem');
  const balanceRaw = (await getPublicClient().readContract({
    address: GAS_TOKEN as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [scaAddress],
  })) as bigint;

  const outflowRaw = sumUsdcTransferOutflow(calls);

  try {
    const gasReserveRaw = await estimateUsdcGasReserveForCalls(client, pimlicoClient, calls);
    const required = outflowRaw + gasReserveRaw;
    if (balanceRaw < required) {
      throw insufficientUsdcError(balanceRaw, outflowRaw, gasReserveRaw);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Insufficient USDC balance.')) {
      throw err;
    }
    if (balanceRaw < outflowRaw) {
      throw insufficientUsdcError(balanceRaw, outflowRaw, 0n);
    }
    throw new Error(formatScaTransactionError(err));
  }
}

export async function buildAllowanceAndTxCalls(params: {
  spender: `0x${string}`;
  fromToken: `0x${string}`;
  fromAmount: bigint;
  scaAddress: `0x${string}`;
  tx: SmartAccountCall;
}): Promise<SmartAccountCall[]> {
  const { encodeFunctionData, erc20Abi, maxUint256 } = require('viem') as typeof import('viem');
  const { spender, fromToken, fromAmount, scaAddress, tx } = params;

  const calls: SmartAccountCall[] = [];
  const currentAllowance = (await getPublicClient().readContract({
    address: fromToken,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [scaAddress, spender],
  })) as bigint;
  if (currentAllowance < fromAmount) {
    calls.push({
      to: fromToken,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, maxUint256] }),
    });
  }
  calls.push(tx);
  return calls;
}

export async function estimateErc20GasUsdc(
  client: AnyClient,
  pimlicoClient: AnyClient,
  calls: SmartAccountCall[],
): Promise<number> {
  const { base } = require('viem/chains') as typeof import('viem/chains');
  const userOperation = await client.prepareUserOperation({ calls });
  const { costInToken } = await pimlicoClient.estimateErc20PaymasterCost({
    userOperation,
    token: GAS_TOKEN as `0x${string}`,
    chain: base,
  });
  return Number(costInToken) / 1_000_000;
}

export async function signScaMessage(
  getEmbeddedProvider: () => Promise<unknown>,
  message: string,
): Promise<string> {
  const { smartAccountClient } = await resolveKuraSmartAccountClient(getEmbeddedProvider);
  return (await smartAccountClient.signMessage({ message })) as string;
}

export async function signScaTypedData(
  getEmbeddedProvider: () => Promise<unknown>,
  typedData: TypedDataInput,
): Promise<string> {
  const { smartAccountClient } = await resolveKuraSmartAccountClient(getEmbeddedProvider);
  return (await smartAccountClient.signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
  })) as string;
}

export async function sendScaTransaction(
  getEmbeddedProvider: () => Promise<unknown>,
  tx: { to: string; data?: string; value?: string },
): Promise<string> {
  const { smartAccountClient, smartAddress, pimlicoClient } =
    await resolveKuraSmartAccountClient(getEmbeddedProvider);
  const calls = await withGasApprovalCalls(pimlicoClient, smartAddress, [
    {
      to: tx.to as `0x${string}`,
      data: (tx.data ?? '0x') as `0x${string}`,
      value: BigInt(tx.value ?? '0'),
    },
  ]);

  try {
    await assertSufficientUsdcForUserOp(smartAddress, smartAccountClient, pimlicoClient, calls);
    return (await smartAccountClient.sendTransaction({ calls })) as string;
  } catch (err) {
    throw new Error(formatScaTransactionError(err));
  }
}
