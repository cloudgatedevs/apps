// Live back-office events over the Cloudgate WebSocket channel "shop-events".
//
// Workflows publish small JSON events on the paths that change what the back
// office shows (order paid, stock adjusted). Pages subscribe with useLiveEvents
// and refetch; there is no client-side state derived from the events.
//
// The channel is protected with Basic credentials (VITE_CLOUDGATE_WS_USER /
// VITE_CLOUDGATE_WS_PASSWORD). They ship in the back-office bundle, so keep the
// payloads free of customer data — they are, by design.
import { useEffect } from 'react';
import { createCloudgateWebSockets } from '@cloudgatedevs/cloudgate-client';
import { apiEnv } from '@/shared/services/api';

const CHANNEL = 'shop-events';
const user = String(import.meta.env.VITE_CLOUDGATE_WS_USER ?? '').trim();
const password = String(import.meta.env.VITE_CLOUDGATE_WS_PASSWORD ?? '').trim();
const baseUrl = String(import.meta.env.VITE_CLOUDGATE_API_URL ?? '').trim();

export const liveEnabled = Boolean(baseUrl && user && password);

const sockets = liveEnabled
  ? createCloudgateWebSockets({ baseUrl, environment: apiEnv, username: user, password })
  : null;

const handlers = new Set();
let connectionKey = null;
let status = 'idle';
const statusListeners = new Set();

function ensureConnected() {
  if (!sockets || connectionKey) return;
  connectionKey = sockets.connect(CHANNEL, {
    onMessage: (payload) => {
      const event = payload && typeof payload === 'object' ? payload : null;
      if (!event?.type) return;
      handlers.forEach((h) => {
        try {
          h(event);
        } catch (err) {
          console.error('[live] handler failed', err);
        }
      });
    },
    onStatus: (s) => {
      status = s;
      statusListeners.forEach((l) => l(s));
    },
  });
}

/**
 * Subscribe to live events for the lifetime of a component.
 * @param {(event: { type: string, [k: string]: any }) => void} onEvent
 * @param {string[]} [types] only these event types (default: all)
 */
export function useLiveEvents(onEvent, types) {
  useEffect(() => {
    if (!liveEnabled) return undefined;
    const handler = (event) => {
      if (!types || types.includes(event.type)) onEvent(event);
    };
    handlers.add(handler);
    ensureConnected();
    return () => {
      handlers.delete(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEvent, types?.join('|')]);
}

export function useLiveStatus(onStatus) {
  useEffect(() => {
    if (!liveEnabled) return undefined;
    statusListeners.add(onStatus);
    onStatus(status);
    return () => statusListeners.delete(onStatus);
  }, [onStatus]);
}
