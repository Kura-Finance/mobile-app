import { formatJsonRpcError, formatJsonRpcResult } from '@walletconnect/jsonrpc-utils';
import { getSdkError } from '@walletconnect/utils';
import { hexToString, isAddress, isHex } from 'viem';
import {
  resolveKuraSmartAccountClient,
  sendScaTransaction,
  signScaMessage,
  signScaTypedData,
  type TypedDataInput,
} from '../wallet/smartAccountClient';
import { BASE_CAIP2, BASE_CHAIN_ID_HEX } from './constants';
import Logger from '../../shared/utils/Logger';

const TAG = 'WcSessionRouter';

type GetEmbeddedProvider = () => Promise<unknown>;

interface WcRequestPayload {
  method: string;
  params: unknown;
}

function parsePersonalSignMessage(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('Invalid sign message payload.');
  if (isHex(raw)) {
    try {
      return hexToString(raw as `0x${string}`);
    } catch {
      return raw;
    }
  }
  return raw;
}

function parseTypedData(params: unknown[]): TypedDataInput {
  const typedDataRaw = params[1];
  if (typeof typedDataRaw === 'string') {
    return JSON.parse(typedDataRaw) as TypedDataInput;
  }
  return typedDataRaw as TypedDataInput;
}

function parseSendTransaction(params: unknown[]): {
  to: string;
  data?: string;
  value?: string;
} {
  const tx = params[0];
  if (!tx || typeof tx !== 'object') throw new Error('Invalid transaction payload.');
  const record = tx as Record<string, unknown>;
  const to = record.to;
  if (typeof to !== 'string' || !isAddress(to)) throw new Error('Invalid transaction recipient.');
  return {
    to,
    data: typeof record.data === 'string' ? record.data : undefined,
    value: typeof record.value === 'string' ? record.value : undefined,
  };
}

function parseSwitchChain(params: unknown[]): void {
  const param = params[0];
  if (!param || typeof param !== 'object') throw new Error('Invalid chain switch payload.');
  const chainId = (param as Record<string, unknown>).chainId;
  if (typeof chainId !== 'string') throw new Error('Invalid chain id.');
  if (chainId.toLowerCase() !== BASE_CHAIN_ID_HEX.toLowerCase()) {
    throw new Error('Kura Wallet only supports Base.');
  }
}

export async function executeWalletConnectRequest(
  getEmbeddedProvider: GetEmbeddedProvider,
  smartAddress: string,
  request: WcRequestPayload,
): Promise<unknown> {
  const { method, params } = request;
  const paramList = Array.isArray(params) ? params : [];

  Logger.info(TAG, 'Handling WC request', { method });

  switch (method) {
    case 'eth_accounts':
    case 'eth_requestAccounts':
      return [smartAddress];

    case 'eth_chainId':
      return BASE_CHAIN_ID_HEX;

    case 'personal_sign': {
      const messageParam = paramList[0];
      const message = parsePersonalSignMessage(messageParam);
      return signScaMessage(getEmbeddedProvider, message);
    }

    case 'eth_sign': {
      const messageParam = paramList[1] ?? paramList[0];
      const message = parsePersonalSignMessage(messageParam);
      return signScaMessage(getEmbeddedProvider, message);
    }

    case 'eth_signTypedData':
    case 'eth_signTypedData_v3':
    case 'eth_signTypedData_v4':
      return signScaTypedData(getEmbeddedProvider, parseTypedData(paramList));

    case 'eth_sendTransaction':
      return sendScaTransaction(getEmbeddedProvider, parseSendTransaction(paramList));

    case 'wallet_switchEthereumChain':
      parseSwitchChain(paramList);
      return null;

    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

export function formatWcSuccess(id: number, result: unknown) {
  return formatJsonRpcResult(id, result);
}

export function formatWcUserRejected(id: number) {
  return formatJsonRpcError(id, getSdkError('USER_REJECTED'));
}

export function formatWcError(id: number, message: string) {
  return formatJsonRpcError(id, {
    code: 5000,
    message,
  });
}

export async function verifySmartAddressMatches(
  getEmbeddedProvider: GetEmbeddedProvider,
  expectedSca: string,
): Promise<void> {
  const { smartAddress } = await resolveKuraSmartAccountClient(getEmbeddedProvider);
  if (smartAddress.toLowerCase() !== expectedSca.toLowerCase()) {
    throw new Error('Smart account address mismatch.');
  }
}

export function buildSupportedNamespaces(scaAddress: string) {
  const account = `${BASE_CAIP2}:${scaAddress}`;
  return {
    eip155: {
      chains: [BASE_CAIP2],
      methods: [...[
        'eth_accounts',
        'eth_requestAccounts',
        'eth_chainId',
        'personal_sign',
        'eth_sign',
        'eth_signTypedData',
        'eth_signTypedData_v3',
        'eth_signTypedData_v4',
        'eth_sendTransaction',
        'wallet_switchEthereumChain',
      ]],
      events: ['accountsChanged', 'chainChanged'],
      accounts: [account],
    },
  };
}
