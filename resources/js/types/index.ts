import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    photobooth: PhotoboothSettings;
    [key: string]: unknown;
}

export type CaptureMode = 'collage' | 'boomerang';

export type LookSlug =
    | 'classic'
    | 'ivory'
    | 'golden'
    | 'blush'
    | 'royal'
    | 'vintage'
    | 'instant'
    | 'seventies'
    | 'heirloom'
    | 'retro'
    | 'noir'
    | 'silver'
    | 'vivid'
    | 'lomo'
    | 'dreamy'
    | 'moody';

export type PartyModule = 'stickers' | 'who_are_you' | 'challenges' | 'hearts' | 'quiz' | 'mosaic' | 'backdrops';

/** Settings the server shares with every page (secrets are never included). */
export interface PhotoboothSettings {
    couple: {
        short: string;
        full: string;
        groom: string;
        bride: string;
        groom_short: string;
        bride_short: string;
    };
    wedding_date: string | null;
    venue: string | null;
    hashtag: string | null;
    thank_you_message: string | null;
    share_url: string;
    download_prefix: string;
    countdown_seconds: number;
    modes: CaptureMode[];
    looks: LookSlug[];
    default_look: LookSlug;
    look_picker_enabled: boolean;
    sounds_enabled: boolean;
    front_flash_enabled: boolean;
    gallery_access: 'public' | 'code';
    allow_zip_downloads: boolean;
    after_wedding_mode: boolean;
    modules: Record<PartyModule, boolean>;
    pose_prompts: { en: string[]; fil: string[] };
}

/** A collage shown behind the attract screen. */
export interface RecentCollage {
    uuid: string;
    image: string;
    color: string | null;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
