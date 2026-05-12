declare module '@walletconnect/react-native-compat' {
  export interface WalletConnectOptions {
    projectId: string;
    relayUrl?: string;
    metadata?: {
      name?: string;
      description?: string;
      url?: string;
      icons?: string[];
    };
  }

  export interface ConnectOptions {
    chains?: number[];
  }

  export interface WalletConnectSession {
    accounts: string[];
    chainId?: number;
  }

  export default class WalletConnect {
    constructor(options: WalletConnectOptions);
    connect(options: ConnectOptions[]): Promise<WalletConnectSession>;
    disconnect(): Promise<void>;
    request(request: any): Promise<any>;
  }
}
