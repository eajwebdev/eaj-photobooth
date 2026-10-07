import { useCallback, useEffect, useState } from 'react';

/**
 * True while the element is on screen (or within `rootMargin` of it). Uses a
 * callback ref, so it also works for elements that appear after first render.
 */
export function useInView<T extends Element>(rootMargin = '0px'): [(element: T | null) => void, boolean] {
    const [element, setElement] = useState<T | null>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (!element || typeof IntersectionObserver === 'undefined') {
            setInView(false);

            return;
        }

        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
        observer.observe(element);

        return () => observer.disconnect();
    }, [element, rootMargin]);

    return [useCallback((next: T | null) => setElement(next), []), inView];
}
