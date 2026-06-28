/** Imperative handlers for Portfolio sub-screen header buttons. */

export interface PortfolioHeaderHandlers {
  onBack?: () => void;
}

let handlers: PortfolioHeaderHandlers | null = null;

export function setPortfolioHeaderHandlers(next: PortfolioHeaderHandlers | null): void {
  handlers = next;
}

export function getPortfolioHeaderHandlers(): PortfolioHeaderHandlers | null {
  return handlers;
}
