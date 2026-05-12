export interface KuraApiErrorPayload {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

export class KuraApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(payload: KuraApiErrorPayload) {
    super(payload.message);
    this.name = 'KuraApiError';
    this.code = payload.code;
    this.status = payload.status;
    this.details = payload.details;
  }

  isRateLimited(): boolean {
    return this.status === 429 || this.code === 'RATE_LIMITED';
  }

  isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }
}

export class KuraNetworkError extends KuraApiError {
  constructor(message: string) {
    super({ code: 'NETWORK_ERROR', message, status: 0 });
    this.name = 'KuraNetworkError';
  }
}

export class UserKeyPairNotFoundError extends KuraApiError {
  constructor() {
    super({
      code: 'KEY_PAIR_NOT_FOUND',
      message: 'User keypair record does not exist.',
      status: 404,
    });
    this.name = 'UserKeyPairNotFoundError';
  }
}
