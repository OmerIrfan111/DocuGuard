import { useEffect, useRef, useState } from 'react';
import { getDocumentStatus } from '../api/documents';

const DONE = new Set(['completed', 'failed']);

// Polls a document's status every `interval` ms until it is completed or failed.
export function useDocumentStatus(documentId, initialStatus, interval = 5000) {
  const [status, setStatus] = useState(initialStatus || 'pending');
  const [data, setData] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!documentId || DONE.has(initialStatus)) {
      if (initialStatus) setStatus(initialStatus);
      return undefined;
    }
    let active = true;
    const tick = async () => {
      try {
        const s = await getDocumentStatus(documentId);
        if (!active) return;
        setData(s);
        setStatus(s.status);
        if (DONE.has(s.status) && timer.current) clearInterval(timer.current);
      } catch {
        /* keep polling */
      }
    };
    tick();
    timer.current = setInterval(tick, interval);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return { status, data, isProcessing: !DONE.has(status) };
}
