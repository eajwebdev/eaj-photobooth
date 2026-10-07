import type { Brand } from '@/lib/compose';
import { formatWeddingDate } from '@/lib/format';
import type { PhotoboothSettings } from '@/types';

/** The couple's names, date and hashtag as printed on every collage. */
export function brandFrom(settings: PhotoboothSettings): Brand {
    return {
        groom: settings.couple.groom_short,
        bride: settings.couple.bride_short,
        date: formatWeddingDate(settings.wedding_date, { weekday: undefined }),
        postmarkDate: formatWeddingDate(settings.wedding_date, { weekday: undefined, month: 'short' }),
        hashtag: settings.hashtag,
    };
}
