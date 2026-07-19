import type { LiFiBridgeQuote } from '../../../../lib/api/bridge/lifiClient';
import type { SwapQuote } from '../../../../lib/api/bridge/lifiSwapClient';
import type { MorphoVaultAssetRef } from '../../../../lib/wallet/morphoVault';
import type {
  ImportMnemonicType,
  SmartAccountCall as Call,
  TypedDataInput,
} from '../../../../lib/wallet/smartAccountClient';
import type { TokenBalances } from '../../../crypto/hooks/useBaseBalances';

export type { ImportMnemonicType, TypedDataInput, Call };

export interface MorphoEarnVaultParams {
  innerVaultAddress: `0x${string}`;
  depositVaultAddress: `0x${string}`;
  usesFeeWrapper: boolean;
  asset: MorphoVaultAssetRef;
}

export interface MorphoEarnWithdrawParams extends MorphoEarnVaultParams {
  withdrawAll: boolean;
  amountAssets?: number;
}

export type MorphoBorrowTxParams = import('../../../../lib/wallet/morphoBlue').MorphoBorrowTxParams;
export type MorphoRepayTxParams = import('../../../../lib/wallet/morphoBlue').MorphoRepayTxParams;
export type MorphoWithdrawCollateralTxParams =
  import('../../../../lib/wallet/morphoBlue').MorphoWithdrawCollateralTxParams;

export type WalletStatus = 'loading' | 'provisioning' | 'ready' | 'error';

 
export type AnySmartAccountClient = any;

export interface KuraSmartAccountClients {
  smartAccountClient: AnySmartAccountClient;
  smartAddress: `0x${string}`;
  pimlicoClient: AnySmartAccountClient;
}

export type ResolveSmartAccountClient = () => Promise<KuraSmartAccountClients>;

export interface UseKuraCardWalletReturn {
  status: WalletStatus;
  smartAddress: string;
  truncatedAddress: string;
  balances: TokenBalances;
  balancesLoading: boolean;
  balancesHasLoaded: boolean;
  usdcBalance: number;
  errorMessage: string;
  isSending: boolean;
  isBridging: boolean;
  isExecutingSwap: boolean;
  isExecutingEarn: boolean;
  isExecutingBorrow: boolean;
  importWallet: (phrase: string, type: ImportMnemonicType) => Promise<void>;
  refreshBalance: () => Promise<void>;
  sendUsdc: (toAddress: string, amountUsdc: number) => Promise<string>;
  sendToken: (
    tokenAddress: `0x${string}`,
    decimals: number,
    toAddress: string,
    amount: number,
  ) => Promise<string>;
  sendNativeEth: (toAddress: string, amountEth: number) => Promise<string>;
  wrapEthToWeth: (amountEth: number) => Promise<string>;
  estimateUsdcGasReserve: () => Promise<number>;
  executeBridge: (quote: LiFiBridgeQuote) => Promise<string>;
  estimateBridgeGasUsdc: (quote: LiFiBridgeQuote) => Promise<number>;
  executeSwap: (quote: SwapQuote) => Promise<string>;
  estimateSwapGasUsdc: (quote: SwapQuote) => Promise<number>;
  executeMorphoDeposit: (params: MorphoEarnVaultParams & { amount: number }) => Promise<string>;
  executeMorphoWithdraw: (params: MorphoEarnWithdrawParams) => Promise<string>;
  estimateMorphoDepositGasUsdc: (params: MorphoEarnVaultParams & { amount: number }) => Promise<number>;
  estimateMorphoWithdrawGasUsdc: (params: MorphoEarnWithdrawParams) => Promise<number>;
  executeMorphoBorrow: (params: MorphoBorrowTxParams) => Promise<string>;
  executeMorphoRepay: (params: MorphoRepayTxParams) => Promise<string>;
  estimateMorphoBorrowGasUsdc: (params: MorphoBorrowTxParams) => Promise<number>;
  estimateMorphoRepayGasUsdc: (params: MorphoRepayTxParams) => Promise<number>;
  executeMorphoWithdrawCollateral: (params: MorphoWithdrawCollateralTxParams) => Promise<string>;
  estimateMorphoWithdrawCollateralGasUsdc: (params: MorphoWithdrawCollateralTxParams) => Promise<number>;
  signMessage: (message: string) => Promise<string>;
  signTypedData: (typedData: TypedDataInput) => Promise<string>;
}
