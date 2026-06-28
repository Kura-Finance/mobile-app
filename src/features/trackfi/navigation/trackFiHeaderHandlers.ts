/** Imperative handlers for TrackFi header buttons (Header lives outside TrackFiScreen tree). */

export interface TrackFiHeaderHandlers {
  onBack?: () => void;
  onLock: () => void;
}

let handlers: TrackFiHeaderHandlers | null = null;

export function setTrackFiHeaderHandlers(next: TrackFiHeaderHandlers | null): void {
  handlers = next;
}

export function getTrackFiHeaderHandlers(): TrackFiHeaderHandlers | null {
  return handlers;
}
