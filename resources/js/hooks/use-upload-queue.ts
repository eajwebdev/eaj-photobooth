import { subscribe, type QueueSnapshot } from '@/lib/upload-queue';
import { useEffect, useState } from 'react';

const EMPTY: QueueSnapshot = { items: [], waiting: 0, failed: 0, progress: {} };

/** Live view of the upload queue (counts, states and progress). */
export function useUploadQueue(): QueueSnapshot {
    const [snapshot, setSnapshot] = useState<QueueSnapshot>(EMPTY);

    useEffect(() => subscribe(setSnapshot), []);

    return snapshot;
}
