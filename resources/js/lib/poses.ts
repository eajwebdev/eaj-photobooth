const CURSOR_KEY = 'je.poseCursor';

/** English and Filipino prompts interleaved (two English, then one Filipino) so every group hears both. */
export function poseDeck(prompts: { en: string[]; fil: string[] }): string[] {
    const deck: string[] = [];
    let english = 0;
    let filipino = 0;

    while (english < prompts.en.length || filipino < prompts.fil.length) {
        for (let i = 0; i < 2 && english < prompts.en.length; i++) {
            deck.push(prompts.en[english++]);
        }

        if (filipino < prompts.fil.length) {
            deck.push(prompts.fil[filipino++]);
        }
    }

    return deck;
}

/**
 * The next `count` prompts. A cursor stored on the device carries on where the
 * previous group stopped, so groups in a row get different poses.
 */
export function nextPrompts(prompts: { en: string[]; fil: string[] }, count: number): string[] {
    const deck = poseDeck(prompts);

    if (deck.length === 0) {
        return Array.from({ length: count }, () => 'Big smiles!');
    }

    let cursor = 0;

    try {
        cursor = Number.parseInt(window.localStorage.getItem(CURSOR_KEY) ?? '0', 10) || 0;
    } catch {
        cursor = 0;
    }

    const picked = Array.from({ length: count }, (_, i) => deck[(cursor + i) % deck.length]);

    try {
        window.localStorage.setItem(CURSOR_KEY, String((cursor + count) % deck.length));
    } catch {
        // The rotation restarts next time; harmless.
    }

    return picked;
}
