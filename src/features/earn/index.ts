/**
 * Morpho Earn feature — public exports for Discover / Portfolio integration.
 */
export { default as EarnView } from './screens/EarnView';
export { default as EarnDetailModal } from './modals/EarnDetailModal';
export { useMorphoVaults } from './hooks/useMorphoVaults';
export { useEarnVaultChart } from './hooks/useEarnVaultChart';
export { useMorphoVaultPosition } from './hooks/useMorphoVaultPosition';
export type { MorphoVaultPositionDetail } from './hooks/useMorphoVaultPosition';
export * from './config';
