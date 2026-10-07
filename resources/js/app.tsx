import '../css/app.css';

// Self-hosted so the booth looks right even when the venue has no internet.
import '@fontsource/bodoni-moda/400-italic.css';
import '@fontsource/bodoni-moda/400.css';
import '@fontsource/bodoni-moda/500-italic.css';
import '@fontsource/bodoni-moda/600.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';

// Registers the album-code listener before the queue starts sending.
import '@/lib/album-session';
import { installLightboxHistory } from '@/lib/lightbox-history';
import { startUploadQueue } from '@/lib/upload-queue';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { route as routeFn } from 'ziggy-js';

declare global {
    const route: typeof routeFn;
}

// Must run before Inertia starts, so the photo viewer sees back/forward first.
installLightboxHistory();

const appName = import.meta.env.VITE_APP_NAME || 'Edwin & Jochel Photobooth';

createInertiaApp({
    title: (title) => (title ? `${title} | ${appName}` : appName),
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#C9A14A',
    },
});

// Anything saved on this device but not yet uploaded resumes as soon as the app opens.
startUploadQueue();
