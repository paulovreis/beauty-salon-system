import { useEffect, useRef } from 'react';
import { forceHttpsWhenPageIsHttps } from '../utils/forceHttpsWhenPageIsHttps';

const API_URL = forceHttpsWhenPageIsHttps(
  process.env.REACT_APP_API_URL || 'http://localhost:5000'
);

/**
 * Subscribe to the server-sent events stream.
 * @param {Record<string, (data: object) => void>} handlers - map of event name → callback
 * @param {boolean} enabled - set to false to skip connecting (e.g. when not authenticated)
 */
export function useSSE(handlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const url = `${API_URL}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const onMessage = (eventName, e) => {
      try {
        const data = JSON.parse(e.data);
        handlersRef.current[eventName]?.(data);
      } catch {
        // ignore malformed events
      }
    };

    const eventNames = Object.keys(handlersRef.current);
    eventNames.forEach((name) => {
      es.addEventListener(name, (e) => onMessage(name, e));
    });

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here
    };

    return () => {
      es.close();
    };
  }, [enabled]);
}
