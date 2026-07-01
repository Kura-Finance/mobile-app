/**
 * Morpho Earn vault addresses shared by earn config and wallet tx classification.
 * Kept free of expo/env imports so unit tests can import safely.
 */

export const DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST = [
  '0xbeef0e0834849aCC03f0089F01f4F1Eeb06873C9',
  '0x94Af495DE1F56Aa5576dEB17986bDCeE5Dd9778D',
  '0x050cE30b927Da55177A4914EC73480238BAD56f0',
  '0x1deEfABEe758AAbdC29a542B24ca3b75aFD56765',
] as const satisfies readonly `0x${string}`[];

export const DEFAULT_MORPHO_FEE_WRAPPER_OVERRIDES = {
  '0xbeef0e0834849aCC03f0089F01f4F1Eeb06873C9': '0x0F457aa0AfD3D208cbfEE520804118f88965a529',
  '0x94Af495DE1F56Aa5576dEB17986bDCeE5Dd9778D': '0x6D10990b11f88EE40e4ABc2f8CbE1f7194190Db0',
  '0x050cE30b927Da55177A4914EC73480238BAD56f0': '0x50e8B8B50037322BE0Efc2048d66Cb957f349816',
  '0x1deEfABEe758AAbdC29a542B24ca3b75aFD56765': '0x07540AeeD4B12408c87365417aE7CE59A966CA47',
} as const satisfies Record<string, `0x${string}`>;

export function buildMorphoEarnVaultAddressSet(
  vaultAllowlist: readonly string[],
  feeWrapperOverrides: Record<string, string>,
): Set<string> {
  const set = new Set<string>();
  for (const addr of vaultAllowlist) {
    set.add(addr.toLowerCase());
  }
  for (const [inner, wrapper] of Object.entries(feeWrapperOverrides)) {
    set.add(inner.toLowerCase());
    set.add(wrapper.toLowerCase());
  }
  return set;
}

/** Default inner + fee-wrapper vault addresses for on-chain detection. */
export function defaultMorphoEarnVaultAddressSet(): Set<string> {
  return buildMorphoEarnVaultAddressSet(
    DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST,
    DEFAULT_MORPHO_FEE_WRAPPER_OVERRIDES,
  );
}
