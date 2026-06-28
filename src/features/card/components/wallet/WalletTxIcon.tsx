/**
 * Dedicated stroke icons for wallet transaction rows (Buy / Sell / Deposit / Borrow).
 * Falls back to Ionicons for other activity kinds.
 */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { WalletTx } from '../../hooks/useWalletHistory';
import { getTxIconKind, getTxIconName } from '../../utils/walletTxDisplay';

const STROKE = 1.75;

interface IconProps {
  size?: number;
  color?: string;
}

/** Shopping cart — crypto purchase. */
export function BuyTxIcon({ size = 18, color = '#10B981' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 7h14l-1.6 8.5H7.6L6 7Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path
        d="M6 7 4.8 3.5H2.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="9" cy="19.5" r="1.1" fill={color} />
      <Circle cx="16.5" cy="19.5" r="1.1" fill={color} />
    </Svg>
  );
}

/** Price tag — crypto sale. */
export function SellTxIcon({ size = 18, color = '#F59E0B' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.5 11.5 12.5 3.5 3.5 12.5V20.5h8l9-9Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Circle cx="8.5" cy="8.5" r="1.4" fill={color} />
    </Svg>
  );
}

/** Arrow up into vault — Earn / collateral deposit. */
export function DepositTxIcon({ size = 18, color = '#F59E0B' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="4"
        y="14"
        width="16"
        height="7"
        rx="2"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Path
        d="M12 4v7M8.5 7.5 12 4l3.5 3.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Arrow down from protocol — Morpho borrow. */
export function BorrowTxIcon({ size = 18, color = '#10B981' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="4"
        y="3"
        width="16"
        height="7"
        rx="2"
        stroke={color}
        strokeWidth={STROKE}
      />
      <Path
        d="M12 10v7M8.5 13.5 12 17l3.5-3.5"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface WalletTxIconProps extends IconProps {
  tx: WalletTx;
}

export default function WalletTxIcon({ tx, size = 18, color }: WalletTxIconProps) {
  const kind = getTxIconKind(tx);

  switch (kind) {
    case 'buy':
      return <BuyTxIcon size={size} color={color} />;
    case 'sell':
      return <SellTxIcon size={size} color={color} />;
    case 'deposit':
      return <DepositTxIcon size={size} color={color} />;
    case 'borrow':
      return <BorrowTxIcon size={size} color={color} />;
    default:
      return (
        <Ionicons
          name={getTxIconName(tx) as keyof typeof Ionicons.glyphMap}
          size={size}
          color={color}
        />
      );
  }
}
