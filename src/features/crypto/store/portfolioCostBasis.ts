export interface CostLot {
  quantity: number;
  costUsd: number;
}

export interface CostPosition {
  key: string;
  quantity: number;
  unitPriceUsd: number;
  valueUsd: number;
}

/** Average-cost sync: increases add cost at current price; decreases reduce proportionally. */
export function applyCostSync(prev: CostLot | undefined, current: CostPosition): CostLot {
  const { quantity, unitPriceUsd } = current;
  const p = prev ?? { quantity: 0, costUsd: 0 };

  if (quantity <= 0) return { quantity: 0, costUsd: 0 };

  if (quantity > p.quantity + 1e-12) {
    const delta = quantity - p.quantity;
    return { quantity, costUsd: p.costUsd + delta * unitPriceUsd };
  }

  if (quantity < p.quantity - 1e-12 && p.quantity > 0) {
    const ratio = quantity / p.quantity;
    return { quantity, costUsd: p.costUsd * ratio };
  }

  return { quantity: p.quantity, costUsd: p.costUsd };
}

export function syncCostLots(
  prev: Record<string, CostLot>,
  positions: CostPosition[],
): Record<string, CostLot> {
  const next: Record<string, CostLot> = { ...prev };
  const activeKeys = new Set(positions.map((p) => p.key));

  for (const pos of positions) {
    next[pos.key] = applyCostSync(prev[pos.key], pos);
  }

  for (const key of Object.keys(prev)) {
    if (!activeKeys.has(key)) {
      next[key] = { quantity: 0, costUsd: 0 };
    }
  }

  return next;
}

export interface AllTimePnL {
  changeUsd: number;
  changePct: number;
}

export function computeAllTimePnL(
  positions: Array<{ key: string; valueUsd: number }>,
  lots: Record<string, CostLot>,
): AllTimePnL {
  let totalValue = 0;
  let totalCost = 0;

  for (const p of positions) {
    if (p.valueUsd <= 0) continue;
    totalValue += p.valueUsd;
    totalCost += lots[p.key]?.costUsd ?? 0;
  }

  const changeUsd = totalValue - totalCost;
  const changePct = totalCost > 0 ? (changeUsd / totalCost) * 100 : 0;
  return { changeUsd, changePct };
}
