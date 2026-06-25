/**
 * @deprecated Import from `../../../config/earn` or `../../../config/earnFeeWrapper`.
 */
export {
  DEFAULT_MORPHO_EARN_VAULT_ALLOWLIST,
  MORPHO_EARN_FEE_BPS,
  MORPHO_EARN_FEE_RATE,
  MORPHO_EARN_VAULT_ALLOWLIST as EARN_VAULT_ALLOWLIST,
  MORPHO_EARN_VAULT_ALLOWLIST,
  MORPHO_FEE_WRAPPER_OVERRIDES,
  KURA_EARN_FEE_RECIPIENT,
  filterEarnVaultAllowlist,
  formatEarnFeePercent,
  hasKuraEarnFee,
  isEarnVaultAllowed,
  isMorphoEarnEnabled,
} from '../../../config/earn';

export {
  isMorphoFeeWrapperAutoDiscoverEnabled,
  morphoFeeWrapperConfigSummary,
  parseMorphoFeeWrapperOverrides,
  resolveMorphoDepositFromMap,
  type MorphoFeeWrapperMap,
} from '../../../config/earnFeeWrapper';
