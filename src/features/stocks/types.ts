export interface StockItem {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number | null;
  holdings: number;
  value: number;
}

export type GateState =
  | 'idle'
  | 'checking'
  | 'kyc'
  | 'connect'
  | 'ready'
  | 'waitlist'
  | 'unsupported';
