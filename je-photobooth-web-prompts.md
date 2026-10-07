# Edwin & Jochel Photobooth — Build Prompts (Laravel 12 + React, web)

Prompt pack for building a wedding photobooth that rivals a hired professional booth,
using an AI coding agent (Claude Code, Cursor, Gemini CLI, Codex, Copilot, Antigravity…).

Stack: Laravel 12 + React 19 (Inertia 2, TypeScript, Tailwind 4) + MySQL `je_photobooth`.
Runs in the browser on iPhone, iPad, Android and laptops — front and back camera.

**What guests get:** 20 collage frames · boomerangs · elegant filters · stickers ·
photo challenges · hearts on favourite photos · a couple quiz · a grand-finale photo mosaic ·
pose prompts · every capture saved straight to a beautiful online gallery · their own album via QR ·
download any photo (or all of theirs) whenever they want · a live wall on the projector.
No printing — everything is digital.

**What the couple gets after the wedding:** every photo and boomerang, a printable
digital guestbook (PDF) with each guest's photo, wish and signature, and a thank-you gallery to share.

---

## Step 0 — Project + skills setup (once, before any prompt)

```bash
# 1. Official Laravel 12 React starter kit (Inertia + React 19 + TypeScript + Tailwind 4 + shadcn/ui)
laravel new je-photobooth        # choose: React starter kit, Pest
cd je-photobooth
git init && git add -A && git commit -m "Laravel 12 React starter kit"

# 2. Laravel Boost — official Laravel skills + MCP for your agent
composer require laravel/boost --dev
php artisan boost:install        # pick your agent; select inertia-react, tailwindcss, pest skills

# 3. Vercel React best-practices skill
npx skills add vercel-labs/agent-skills     # choose: react-best-practices

# 4. Anthropic frontend-design skill (distinctive, non-template UI)
#    Copy skills/frontend-design from github.com/anthropics/skills into your agent's skills folder:
#      Claude Code → .claude/skills/frontend-design/
#      Laravel Boost (all agents) → .ai/skills/frontend-design/   then run: php artisan boost:install
```

```sql
CREATE DATABASE je_photobooth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`.env`: `DB_CONNECTION=mysql`, `DB_DATABASE=je_photobooth`, `APP_TIMEZONE=Asia/Manila`,
`QUEUE_CONNECTION=database`.

> Commit after every phase. If a phase goes wrong: `git reset --hard` and run that phase again.

---

## Step 1 — Master prompt (paste first in every new agent session)

```text
You are a senior Laravel + React engineer, a product designer, and an experienced wedding
photobooth operator. Build the best wedding photobooth web app you can — one that guests line up for,
that never loses a photo, and that the couple treasures for years.

Before coding, load and follow the installed skills: Laravel Boost guidelines and skills
(inertia-react, tailwindcss, pest), react-best-practices, and frontend-design. Use the Laravel Boost
MCP tools (search-docs, database-schema, tinker, browser logs) instead of guessing APIs.
On how to use an API the skills win; on product and design these instructions win.

## The event
Wedding of Edwin Abril Jr. & Jochel Agnes. Expect ~150–300 guests, 4–6 hours, 500–1500 captures,
venue Wi-Fi that may drop, guests of all ages (lolas to kids), formal wear, low reception lighting,
and up to 3 booth devices running at once (e.g. main iPad booth, a phone booth, a roaming phone).

## Experience modes (guest picks on the first screen)
1. Photo collage — choose 1 of 20 frames → countdown → N photos → collage. (core)
2. Boomerang — a 1.5 s burst played forward-and-back as a looping branded clip.
Each mode can be turned on/off in admin. (No video or audio recording anywhere — photos and
boomerangs only. Written wishes go in the guestbook.)

## Guest flow (photo collage)
Attract screen (idle) → tap → choose mode → choose frame → choose look (filter) →
camera with pose prompts + countdown → review (retake any photo, name, wish, optional finger
signature for the guestbook) → save → it appears in the gallery automatically →
Done: QR to the group's personal album, "Take more photos" (adds to the same album),
"I'm done" → back to attract screen (also after 90 s idle). NO PRINTING anywhere in the app.

## Albums (how guests find "their" photos)
Each booth session starts a guest album (short readable code like "ROSE-4821"). Every capture taken
before the group taps "I'm done" goes into that album. The Done screen shows a QR + the code for
/a/{code}. Guests scan it on their own phone to see and download everything they took, any time —
during the reception or weeks later. Their phone also remembers albums they opened (localStorage),
so "My photos" in the gallery shows them again without scanning.

## Pages
/            attract + welcome
/booth       guest flow (all modes)
/gallery     the main gallery: every photo and boomerang from the wedding,
             newest first, live-updating, with search by guest name, filters, lightbox, downloads
/gallery?slideshow=1   projector mode
/a/{code}    a guest's personal album (from QR) — view, download one, or download all as ZIP
/p/{uuid}    single capture page (share link) with download
/admin       PIN-protected control room
/keepsake    after the wedding: couple's private page (PIN) with everything + guestbook PDF

## Stack (already scaffolded: Laravel 12 React starter kit)
- Laravel 12, PHP 8.3, MySQL je_photobooth, Pest, database queue (php artisan queue:work)
- React 19 + TypeScript + Inertia 2 + Tailwind CSS 4. Use shadcn/ui only as a base; restyle everything.
- motion (Framer Motion) for animation, qrcode for QR, idb-keyval for the offline queue,
  vite-plugin-pwa for install + offline shell, signature_pad for the guestbook signature,
  gifenc only as a boomerang fallback, barryvdh/laravel-dompdf (or spatie/laravel-pdf) for the
  guestbook PDF.
- Fonts self-hosted via @fontsource/bodoni-moda and @fontsource/jost (works without venue internet).
- Use latest stable versions; never invent package names or versions — verify them.

## Quality bar — "best wedding photobooth" means all of these are true
- Zero lost photos: everything is saved on the device first and uploads itself when it can.
- Tap "Take photos" → first countdown starts in under 2 s. Save → visible in the gallery and QR shown
  in under 3 s on decent Wi-Fi (queued captures appear the moment the upload lands).
- Downloads are full quality (4×6 = 1200×1800 px, 2×6 strip = 600×1800 px, landscape = 1800×1200 px,
  i.e. 300 DPI if a guest prints at home), while the gallery loads fast using small thumbnails.
- A guest can find all of their own photos in under 10 seconds (album QR, "My photos", or name search).
- What is inside the gold guide on screen is exactly what is in the photo.
- Works on iPhone Safari, iPad Safari, Android Chrome, desktop Chrome — front and back camera.
- A first-time 70-year-old guest can finish without help; a 6-year-old can't break it.
- Runs 8 hours without slowing down, on 3 devices at once.
- Every screen looks like a luxury wedding stationery suite, never like a template.

## Camera requirements (web)
- getUserMedia with facingMode {ideal:'user'|'environment'}, width/height ideal 1920×1440.
- Stop every old track before opening a new one (iOS cannot hold two streams).
- If facingMode is ignored, choose the camera by enumerateDevices() label
  (back|rear|environment / front|user|selfie) or another deviceId.
- <video playsInline muted autoPlay>; restart the stream on visibilitychange.
- Front camera: mirror preview AND saved photo. Back camera: never mirror. Hide switch if one camera.
- Capture with ImageCapture.takePhoto() where supported (full resolution on Android Chrome), else draw
  the video frame to a canvas.
- Low light: request exposure/brightness boost where the track supports it; offer a "Brighten screen"
  front-flash (full-white screen for 300 ms during front-camera capture) — on by default for front cam.
- WYSIWYG gold guide of the current slot's centre crop; if the crop extends past the visible preview,
  shrink the video so the full crop is visible.
- Errors with clear fixes: permission blocked, camera in use, no camera → "Try again".
- No HTTPS / no getUserMedia → fallback <input type="file" accept="image/*" capture="user|environment">.

## Design system — "Royal Chapel"
Colors as Tailwind 4 @theme tokens:
  navy #0C1C45 (main background) · navy-2 #132A63 · royal #1F3F95 (primary) · royal-soft #3A5BB5
  gold #C9A14A (accent/CTA) · gold-light #E8D29B (text on navy, hairlines) · gold-deep #A07C2C
  white #FFFFFF · mist #EEF2FA
Gold buttons: vertical gradient #E2C27A → #C9A14A → #A07C2C, 1px inner highlight, pill shape.
Background: navy with a soft royal radial glow at the top and a faint 22px gold dot grid.
Typography: Bodoni Moda for names, titles, countdown numerals (italic for names); Jost for UI.
Sentence case. No ALL-CAPS labels, eyebrow labels, 01/02/03 numbering, generic grey-shadow card grids,
emoji, or clip-art props.
Signature element: a gold double-line chapel ARCH framing an "E & J" monogram. On first load the arch
draws itself (SVG stroke-dashoffset ~1.8 s), then names fade up once. The arch reappears as the app
icon, the QR border motif, the guest page header and the guestbook PDF cover.
Motion answers the guest: countdown numeral springs in, white shutter flash, photo flies into its slot,
one gold sweep across "Saved", shared-layout transition from frame card into camera.
Respect prefers-reduced-motion. Touch targets ≥ 48px (shutter 88px). Contrast ≥ 4.5:1. Inputs ≥ 16px.
Intentional at 375px phone, iPad both orientations, 1080p projector.
Copy: warm, short, plain; buttons say what happens. Errors say what happened and what to do.

## Filters ("looks") — tasteful, wedding-appropriate
Classic (natural, slight warmth), Ivory (soft warm, lifted blacks, gentle glow),
Noir (rich black-and-white, deep contrast), Royal (cool, slightly faded, blue-tinted shadows).
Define each as one 4×5 colour matrix + optional vignette in lib/looks.ts. Live preview uses an
equivalent CSS filter on the video; the saved photo applies the matrix on canvas pixels
(getImageData — do NOT rely on ctx.filter, Safari support is inconsistent). Show 4 live thumbnails
to choose from. Admin chooses which looks are enabled and the default.

## Pose prompts
Shown above the countdown, one per shot, rotating so groups get variety. Defaults (editable in admin,
English and Filipino lists):
"Big smiles!" · "Now a silly one" · "Look at each other" · "Group hug!" · "Point at the camera" ·
"Kiss on the cheek" · "Your best dance move" · "Say 'Mabuhay ang bagong kasal!'" ·
"Ngiti naman diyan!" · "Kunwari nagulat!"
Optional countdown beeps + soft shutter sound (unlock audio on the first tap; mute toggle in admin).

## Settings (DB table `settings`, editable in admin; .env only provides first defaults)
couple names (short + full), wedding date, venue, hashtag, thank-you message, countdown seconds (3),
enabled modes, enabled frames, enabled looks + default, pose prompts, sounds on/off, front flash on/off,
gallery access (public | wedding code required), allow "download all" ZIPs (on/off),
party modules on/off (stickers, who-are-you, challenges + list, hearts, quiz + questions, mosaic,
virtual backdrops),
after-wedding mode (on/off), admin PIN (hashed), keepsake PIN (hashed), share URL.
Expose public settings to every page via Inertia shared props.

## layouts.json → database/data/layouts.json (single source of truth for previews AND the saved image)
Pixels on the output canvas. theme: white | royal | film. style "polaroid" = white instant-photo
border (pad 5% of w, bottom 19% of w) with a soft drop shadow; r = rotation in degrees.
[
 {"slug":"classic-portrait","name":"Classic Portrait","canvas":{"w":1200,"h":1800},"theme":"white","footer":{"y":1400,"h":400},
  "slots":[{"x":80,"y":80,"w":1040,"h":1300}]},
 {"slug":"photo-strip-3","name":"Photo Strip","canvas":{"w":600,"h":1800},"theme":"royal","footer":{"y":1400,"h":400},
  "slots":[{"x":40,"y":40,"w":520,"h":440},{"x":40,"y":500,"w":520,"h":440},{"x":40,"y":960,"w":520,"h":440}]},
 {"slug":"film-strip-4","name":"Film Strip","canvas":{"w":600,"h":1800},"theme":"film","footer":{"y":1440,"h":360},
  "slots":[{"x":80,"y":50,"w":440,"h":330},{"x":80,"y":400,"w":440,"h":330},{"x":80,"y":750,"w":440,"h":330},{"x":80,"y":1100,"w":440,"h":330}]},
 {"slug":"grid-4","name":"Four Square","canvas":{"w":1200,"h":1800},"theme":"white","footer":{"y":1350,"h":450},
  "slots":[{"x":60,"y":60,"w":525,"h":630},{"x":615,"y":60,"w":525,"h":630},{"x":60,"y":720,"w":525,"h":630},{"x":615,"y":720,"w":525,"h":630}]},
 {"slug":"hero-duo","name":"Hero & Duo","canvas":{"w":1200,"h":1800},"theme":"royal","footer":{"y":1350,"h":450},
  "slots":[{"x":60,"y":60,"w":1080,"h":780},{"x":60,"y":870,"w":525,"h":480},{"x":615,"y":870,"w":525,"h":480}]},
 {"slug":"hero-trio-side","name":"Tall & Trio","canvas":{"w":1200,"h":1800},"theme":"white","footer":{"y":1350,"h":450},
  "slots":[{"x":60,"y":60,"w":700,"h":1290},{"x":790,"y":60,"w":350,"h":410},{"x":790,"y":500,"w":350,"h":410},{"x":790,"y":940,"w":350,"h":410}]},
 {"slug":"polaroid-trio","name":"Polaroid Trio","canvas":{"w":1200,"h":1800},"theme":"royal","style":"polaroid","footer":{"y":1450,"h":350},
  "slots":[{"x":130,"y":115,"w":560,"h":560,"r":-6},{"x":540,"y":400,"w":560,"h":560,"r":5},{"x":180,"y":760,"w":560,"h":560,"r":-3}]},
 {"slug":"landscape-duo","name":"Side by Side","canvas":{"w":1800,"h":1200},"theme":"white","footer":{"y":960,"h":240},
  "slots":[{"x":60,"y":60,"w":825,"h":880},{"x":915,"y":60,"w":825,"h":880}]},
 {"slug":"grid-6","name":"Six Moments","canvas":{"w":1200,"h":1800},"theme":"royal","footer":{"y":1350,"h":450},
  "slots":[{"x":60,"y":60,"w":525,"h":410},{"x":615,"y":60,"w":525,"h":410},{"x":60,"y":500,"w":525,"h":410},{"x":615,"y":500,"w":525,"h":410},{"x":60,"y":940,"w":525,"h":410},{"x":615,"y":940,"w":525,"h":410}]},
 {"slug":"mosaic-5","name":"Mosaic","canvas":{"w":1200,"h":1800},"theme":"white","footer":{"y":1350,"h":450},
  "slots":[{"x":60,"y":60,"w":640,"h":520},{"x":730,"y":60,"w":410,"h":520},{"x":60,"y":610,"w":410,"h":740},{"x":500,"y":610,"w":640,"h":355},{"x":500,"y":995,"w":640,"h":355}]},

 {"slug":"arch-window","name":"Chapel Window","category":"classic","canvas":{"w":1200,"h":1800},"theme":"royal","footer":{"y":1430,"h":370},
  "slots":[{"x":150,"y":110,"w":900,"h":1280,"shape":"arch"}]},
 {"slug":"medallion-trio","name":"Medallions","category":"classic","canvas":{"w":1200,"h":1800},"theme":"white","footer":{"y":1350,"h":450},
  "slots":[{"x":250,"y":90,"w":700,"h":700,"shape":"circle"},{"x":90,"y":830,"w":480,"h":480,"shape":"circle"},{"x":630,"y":830,"w":480,"h":480,"shape":"circle"}]},
 {"slug":"heirloom-album","name":"Heirloom Album","category":"classic","canvas":{"w":1200,"h":1800},"theme":"white","style":"heirloom","footer":{"y":1430,"h":370},
  "slots":[{"x":110,"y":110,"w":620,"h":470,"r":-3},{"x":470,"y":520,"w":620,"h":470,"r":2.5},{"x":130,"y":930,"w":620,"h":470,"r":-1.5}]},
 {"slug":"cinema-3","name":"Love Story Cinema","category":"strips","canvas":{"w":1200,"h":1800},"theme":"film","style":"cinema","footer":{"y":1500,"h":300},
  "slots":[{"x":60,"y":60,"w":1080,"h":452},{"x":60,"y":540,"w":1080,"h":452},{"x":60,"y":1020,"w":1080,"h":452}]},
 {"slug":"square-post","name":"Feed Post","category":"social","canvas":{"w":1080,"h":1350},"theme":"white","footer":{"y":1070,"h":280},
  "slots":[{"x":60,"y":60,"w":960,"h":1010}]},
 {"slug":"story-trio","name":"Story Trio","category":"social","canvas":{"w":1080,"h":1920},"theme":"royal","footer":{"y":1650,"h":270},
  "slots":[{"x":90,"y":90,"w":900,"h":500},{"x":90,"y":620,"w":900,"h":500},{"x":90,"y":1150,"w":900,"h":500}]},
 {"slug":"magazine-cover","name":"Magazine Cover","category":"playful","canvas":{"w":1200,"h":1800},"theme":"royal","style":"magazine","footer":{"y":1560,"h":240},
  "slots":[{"x":0,"y":0,"w":1200,"h":1800}]},
 {"slug":"postage-stamps","name":"Love Letters","category":"playful","canvas":{"w":1200,"h":1800},"theme":"royal","style":"stamp","footer":{"y":1400,"h":400},
  "slots":[{"x":110,"y":110,"w":450,"h":560,"r":-2},{"x":640,"y":130,"w":450,"h":560,"r":2},{"x":110,"y":740,"w":450,"h":560,"r":1.5},{"x":640,"y":760,"w":450,"h":560,"r":-2.5}]},
 {"slug":"wish-card","name":"Wish Card","category":"playful","canvas":{"w":1200,"h":1800},"theme":"white","style":"wishcard","footer":{"y":1520,"h":280},"text":{"y":1130,"h":380},
  "slots":[{"x":100,"y":100,"w":1000,"h":1000}]},
 {"slug":"big-family","name":"Big Family","category":"classic","canvas":{"w":1800,"h":1200},"theme":"white","footer":{"y":960,"h":240},
  "slots":[{"x":60,"y":60,"w":1680,"h":900}]}
]
Categories for the first 10 (add a "category" key to each): classic → classic-portrait, grid-4,
hero-duo, hero-trio-side, landscape-duo, grid-6, mosaic-5 · strips → photo-strip-3, film-strip-4 ·
playful → polaroid-trio. Big Family is meant for large groups with the back camera; Feed Post (4:5)
and Story Trio (9:16) are sized for Facebook/Instagram posts and stories.

## Collage rendering rules (canvas, in the browser)
- white theme: white paper; double gold rule frame (3px at inset 18, 1.2px at inset 28, scaled by
  min(w,h)/1200); 2–3px gold line around each slot.
- royal theme: vertical gradient royal → navy, faint gold dot texture, gold-light double frame + slot lines.
- film theme: navy; white rounded sprocket holes (26×18 every 44px) down both edges; no frame.
- Photos fill slots with centre crop (cover math), with the chosen look applied.
- Slot shapes (clip paths): "arch" = rectangle with a semicircular top (radius w/2), drawn with a gold
  double outline echoing the monogram; "circle" = ellipse in the box with a gold ring + thin inner ring.
- style "heirloom": soft mist-white paper, each photo with a 14px white border, faint shadow and four
  gold photo-corner triangles; a small handwritten-style caption under the last photo
  ("Our wedding day" in Bodoni Moda italic).
- style "cinema": letterbox look — navy-black, thin gold rule above and below each frame, tiny
  "Scene 1/2/3" captions in gold-light at each frame's left; footer reads "Edwin & Jochel — a love story".
- style "magazine": full-bleed photo with a navy gradient at top and bottom; masthead "EDWIN & JOCHEL"
  across the top in Bodoni Moda 600 (the one place caps are allowed — it's a magazine), gold issue line
  ("Wedding issue · {date}"), two or three cover lines on the left in white Jost ("Starring {guest name}",
  "The happiest day of the year", "Inside: 300 photos from the party"); footer holds date + hashtag.
- style "stamp": each photo is a postage stamp — white border with scalloped perforated edges
  (circles cut along the border), tiny gold denomination "₱ 20" and "Mahal kita" in a corner;
  a round gold postmark ring over one corner with the wedding date.
- style "wishcard": the guest's written wish is set in Bodoni Moda italic inside the text box (shrink to
  fit, max 4 lines, centred), signed "— {guest name}" in Jost; if the wish is empty, the review screen
  asks for one before saving (with a "Skip" that uses "With love" instead).
- Footer, centred: gold line–diamond–line ornament → "Edwin & Jochel" Bodoni Moda italic (shrink to
  84% width) → date in Jost 500 letter-spaced → hashtag in gold. Under 800px wide (2×6 strips) stack
  the names: "Edwin" / gold "&" / "Jochel", large.
- await document.fonts.load(...) before drawing. JPEG 0.92, sRGB. Raw shots ≤1600px, JPEG 0.85.

## Coding rules
- TypeScript strict, no `any`. Camera logic in useCamera; drawing in pure lib/compose.ts and
  lib/looks.ts with unit-testable math; boomerang in lib/boomerang.ts.
- Laravel: Form Requests, API Resources, thin controllers, Pest tests for every endpoint, queued jobs
  for thumbnails/PDF/ZIP, public disk with relative /storage URLs.
- Every booth device has a station name (set once on the device, stored in localStorage, sent with uploads).
- No secrets in the frontend. PINs checked server-side (hash_equals on hashed values) + rate limiting.
```

---

## Step 2 — Phase prompts (one at a time; test, then commit)

### Phase 1 — Backend foundation

```text
Phase 1 — backend only.
1. config/photobooth.php (first-run defaults from .env) + `settings` table (key, json value) with a
   cached Settings service; seed defaults from the master prompt. Admin PIN and keepsake PIN stored hashed.
2. Migrations (MySQL je_photobooth):
   layouts(id, slug unique, name, description, shots, canvas_w, canvas_h, theme, style nullable,
           slots json, footer json, sort_order, is_active, timestamps)
   captures(id, uuid unique, client_uuid unique, type enum(collage,boomerang),
            layout_id nullable FK, look nullable, media_path, poster_path nullable, thumb_path nullable,
            mime, width, height, duration_ms nullable, size_bytes, guest_name nullable(80),
            message nullable(280), signature_path nullable, camera enum(front,back,upload),
            station nullable(40), device nullable, ip nullable, is_hidden bool indexed,
            downloads uint, timestamps)
   capture_shots(id, capture_id FK cascade, position, image_path, timestamps)
   albums(id, code unique (e.g. "ROSE-4821": wedding word + 4 digits, no confusing characters),
          client_uuid unique, guest_name nullable, station nullable, captures_count, timestamps)
   Party modules (Phase 10): captures also get group_tag nullable, table_no nullable, challenge_id
   nullable, hearts_count, is_couple_favourite; tables challenges(id, title, sort, is_active),
   hearts(capture_id, device_id, unique pair), quiz_questions(id, question, choices json, answer_index,
   sort), quiz_attempts(id, device_id unique, name, score, answers json), mosaics(id, source_path,
   output_path, status, tiles, built_at).
   captures gets album_id FK nullable (indexed). Indexes: (is_hidden, type, id),
   guest_name, created_at.
3. database/data/layouts.json (exact content from the master prompt) + LayoutSeeder (upsert by slug,
   keep is_active).
4. API:
   GET  /api/settings/public         names, date, venue, hashtag, enabled modes/frames/looks, prompts…
   GET  /api/layouts                 active layouts
   POST /api/albums                  idempotent on client_uuid → {code, url}; called when a session starts
                                     (works offline too: the booth makes the client_uuid, the code is
                                     assigned on first successful sync and shown as soon as known)
   POST /api/captures                multipart; idempotent on client_uuid (returns existing, 200);
                                     album client_uuid; validates per type (collage jpeg ≤12MB;
                                     boomerang mp4/webm/gif ≤25MB + poster jpg);
                                     signature png optional; queues thumbnail + 1080px preview jobs
   GET  /api/gallery                 visible captures (collage|boomerang), cursor-paginated,
                                     ?after= for live updates, ?type=, ?q= (guest name), ?album=
   GET  /api/albums/{code}           album + its captures
   GET  /api/albums/{code}/zip       streamed ZIP of the album's photos + boomerangs (if allowed)
   GET  /api/captures/{uuid}         single (404 if hidden)
   GET  /api/captures/{uuid}/download   full-quality file, friendly name, increments downloads
   Admin (X-Admin-Pin, rate-limited): stats, captures list with filters (type, hidden, station, album),
     toggle hidden, delete (removes files), layouts toggle, settings get/update, export ZIP (queued job,
     download link when ready).
5. public/.user.ini: upload_max_filesize=100M, post_max_size=120M, max_file_uploads=12.
6. Pest tests: 20 layouts seeded; album creation idempotent + unique readable codes; collage upload
   with shots lands in its album and in /api/gallery; boomerang upload; idempotent
   client_uuid; name search; album ZIP;
   inactive layout rejected; admin routes need the PIN; hidden capture 404s and leaves the gallery.
Then: git commit -m "Phase 1: database, settings, layouts, albums, captures + gallery API, tests"
```

### Phase 2 — Design system, attract screen, welcome

```text
Phase 2 — design system + attract/welcome. Use the frontend-design skill.
1. Tailwind 4 @theme tokens (Royal Chapel), self-hosted Bodoni Moda + Jost, override default shadcn.
2. Components: GoldButton, GhostButton, IconButton (+ frosted variant), RoyalBackground,
   GoldOrnament (line–diamond–line), Monogram (SVG chapel arch + E & J), Toggle, PinPad.
3. Kiosk shell: 100dvh, safe-area insets, no selection/long-press menus (except saveable photos),
   Screen Wake Lock, fullscreen on first tap (Android), audio unlock on first tap.
4. Welcome (/): arch draws itself, then "The wedding of", "Edwin Abril Jr. / & / Jochel Agnes",
   date · venue fade up once; gold "Take photos" + tap anywhere; "See everyone's photos".
5. Attract mode: after 60 s idle the welcome screen slowly cross-fades the 12 most recent collages
   behind a darkened navy veil while the monogram stays put, with a soft "Tap to take your photos".
   Any touch returns to the normal welcome instantly.
6. Hidden staff entry: long-press the monogram 3 s → /admin. First run on a device asks for a station
   name (e.g. "Main booth"), saved in localStorage.
Acceptance: check at 375×812, 820×1180, 1180×820, 1920×1080 — premium, nothing clipped.
Then: git commit -m "Phase 2: design system, attract mode, welcome"
```

### Phase 3 — Mode, frame and look pickers

```text
Phase 3 — choosing.
1. Mode picker: two large choices — "Photo collage" and "Boomerang" —
   each with a small live-drawn illustration in gold line art (SVG), not stock icons. Only enabled modes.
   If only one mode is enabled, skip this screen.
2. Frame picker (collage): tabs Classic / Strips / Social / Playful (plus "All"), remembered per session;
   LayoutPreview SVG miniatures from layouts.json (support arch/circle shapes and every style);
   responsive grid (2/3/5 cols);
   name in Bodoni Moda, "3 photos" in gold-light; press scales 0.97; shared-layout transition into camera.
3. Look picker: the four looks as live camera thumbnails (one stream, CSS-filtered tiles) with names;
   default pre-selected so guests can just tap "Continue". Skippable in admin (then the default look applies).
Acceptance: a guest goes from welcome to camera in 3 taps or fewer.
Then: git commit -m "Phase 3: mode, frame and look pickers"
```

### Phase 4 — Camera, pose prompts, countdown (most important)

```text
Phase 4 — capture. Follow every camera requirement in the master prompt exactly.
1. useCamera hook: start(facing), switchCamera(), capture(), stop(); states idle|starting|ready|error|
   unsupported; facing detection via getSettings().facingMode then label; deviceId fallback; constraint
   fallbacks; visibilitychange restart; race-safe; stops tracks on unmount.
2. Capture screen: full-screen video with the live look (CSS filter), WYSIWYG gold guide (outside
   dimmed navy 50%), frosted top bar (back, "Photo 2 of 4" + dots, camera switch), bottom: camera label,
   88px gold-ring shutter, hint "Takes 4 in a row".
3. Sequence on one tap: pose prompt appears in Bodoni Moda italic (spring in) → countdown numeral →
   beeps (if on) → front flash (front cam, if on) → shutter flash + sound → capture → thumbnail flies
   into its slot in a mini LayoutPreview in the corner → next. 2 s breather between shots so people
   can change pose.
4. Retake mode for a single slot. Raw shots stored as Blobs in IndexedDB immediately (survive reload).
5. Fallback screen for no live camera.
Acceptance on a REAL iPhone and REAL Android over HTTPS (Cloudflare Tunnel or Herd/Valet secure):
both cameras, repeated switching, mirroring rules, saved photo == inside the guide, readable in
dim light with front flash.
Then: git commit -m "Phase 4: camera, pose prompts, countdown, front flash"
```

### Phase 5 — Composer, looks, review, guestbook signature

```text
Phase 5 — composer and review.
1. lib/looks.ts: 4×5 colour matrices + vignette; applyLook(canvas) via getImageData in chunks
   (keep the UI responsive; use OffscreenCanvas + a Web Worker where supported).
2. lib/compose.ts: every rule in "Collage rendering rules". Vitest tests for crop math, slots inside
   canvas, and matrix output for known pixels.
3. Review: collage large; panel with shot thumbnails (retake badge each), "Your name (optional)",
   "A wish for the couple (optional)", and "Sign the guestbook (optional)" opening a signature pad
   (gold ink on white card, Clear / Done). Gold "Save collage", ghost "Start over" (confirm).
   While composing show the LayoutPreview filled with thumbnails, not a spinner.
4. /dev/frames page (local env only) rendering all 20 frames × 4 looks with sample images.
Acceptance: every frame in every look looks like a premium keepsake; 2×6 names large and readable.
Then: git commit -m "Phase 5: composer, looks, review, guestbook signature"
```

### Phase 6 — Never-lose saving, albums, QR

```text
Phase 6 — saving.
1. IndexedDB upload queue (idb-keyval): {clientUuid, type, blobs, fields, station, attempts, state}.
   Save writes to the queue FIRST, then uploads with XHR progress; retry with exponential backoff
   (2 s → 60 s cap), on 'online', and on app start; 4xx (except 408/429) → failed with server message;
   delete only after 2xx. Show staff a discreet "3 waiting to upload" chip on the welcome screen.
2. Session album: when a guest group starts at the booth, create the album client_uuid (and POST
   /api/albums in the background). All captures until "I'm done" carry that album id.
3. Done screen: "Saved to the gallery. Thank you, {name}!" with one gold sweep; this capture shown
   large; QR (navy on white inside a gold arch-motif border) to {share_url}/a/{code} with the code in
   big readable text ("Your album: ROSE-4821") and the line "Scan to see and download all your photos";
   "Getting your album ready…" until the code arrives. Buttons: gold "Take more photos" (same album)
   and ghost "I'm done" (closes the album, back to attract). Idle 90 s → attract, visible countdown line.
4. Single capture page /p/{uuid}: monogram header, the photo or looping boomerang, gold "Download",
   "Save to Photos or share" (navigator.share with a File where canShare allows), iPhone long-press tip,
   link to its album and to the full gallery.
Acceptance: Wi-Fi off → save 3 collages → reload → Wi-Fi on → all upload exactly once into the same
album; QR opens the album on another phone; downloads named like "Edwin-Jochel-Wedding-0041.jpg".
Then: git commit -m "Phase 6: never-lose upload queue, albums, QR done screen"
```

### Phase 7 — Boomerang

```text
Phase 7 — boomerang mode.
Boomerang:
1. Capture ~24 frames over 1.5 s at 720px from the live video (after a countdown + pose prompt).
2. Build forward + reverse sequence (ping-pong), apply the look, draw each frame inside a branded
   4:5 frame (navy, gold hairline, "Edwin & Jochel" + date footer).
3. Encode: draw frames to a canvas and record canvas.captureStream(30) with MediaRecorder —
   prefer video/mp4 (iOS), else video/webm (Android/Chrome); loop the sequence 3× for a ~4.5 s clip.
   If MediaRecorder can't record canvas, fall back to an animated GIF with gifenc. Also save a poster JPEG.
4. Review: plays muted on loop; "Save boomerang" / "Try again".
5. Name + wish fields like the collage review; saved into the same album.
6. Upload through the same IndexedDB queue (retry-safe; show progress).
Acceptance: boomerangs record and play on iPhone Safari and Android Chrome; they loop silently in the
gallery, album and slideshow; downloads give a file that plays on both phones.
Then: git commit -m "Phase 7: boomerang mode"
```

### Phase 8 — The gallery (the heart of the app)

```text
Phase 8 — gallery and albums. This is where guests spend the most time after the booth;
make it feel like opening a luxury wedding album, not a file list. Use the frontend-design skill.
1. /gallery: header with the arch monogram, "Edwin & Jochel", date, live count ("412 photos and counting").
   Sticky toolbar: tabs All / Collages / Boomerangs, "My photos" (albums this phone has opened,
   from localStorage), and a search field "Find your photos by name".
   Masonry grid (CSS columns; 2 cols phone, 3 tablet, 4–5 desktop) of 520px thumbnails with
   blur-up placeholders (tiny base64 or dominant colour from the server), lazy loading, infinite
   scroll with cursor pagination. Boomerangs autoplay muted only while visible (IntersectionObserver).
   New captures slide in at the top every 10 s ("3 new photos" pill if the guest has scrolled down,
   tap to jump up) — never shift the grid under the guest's finger.
2. Lightbox: tap any item → full-screen viewer with swipe left/right (touch + keyboard), pinch-zoom on
   photos, guest name + wish, and actions: gold "Download" (full quality), "Share"
   (navigator.share with the file), "View album". Loads the 1080px preview first, full file on download.
   URL updates to /p/{uuid} so the back button closes it and links are shareable.
3. Album page /a/{code}: "Your photos" title with the album code and guest name, all their captures
   in capture order, "Download all" (ZIP, streamed) plus single downloads, and a gentle note on iPhone:
   "Tip: open a photo and use Share → Save Image to put it in Photos." Saves the album to "My photos".
4. Empty, loading and offline states that still look elegant (e.g. "No photos match that name yet").
5. Gallery access setting: public, or a wedding code screen (code remembered on the device).
6. Performance: thumbnails ≤ 60 KB, 1080px previews ≤ 250 KB (queued jobs in Phase 1), HTTP caching
   headers on /storage, the gallery stays smooth with 1,500 items on a mid-range Android phone.
Acceptance: on a phone, a guest scans the QR, sees their album, swipes through the whole gallery,
downloads one photo and the album ZIP — all without instructions.
Then: git commit -m "Phase 8: gallery, lightbox, albums, downloads"
```

### Phase 9 — Slideshow, admin, after-wedding keepsake

```text
Phase 9 — projector and control.
1. Slideshow (/gallery?slideshow=1): full-screen, cross-fade every 6 s (boomerangs play one loop),
   side panel with names, guest name and wish in Bodoni Moda, QR "See all the photos" linking to
   /gallery in the corner; jumps to brand-new captures; double-click → fullscreen.
2. /admin: PIN pad (server-checked, rate-limited). Dashboard: live stats (captures by type, today,
   albums, downloads, uploads waiting per station), captures grid with filters (type, station, album,
   hidden), hide/show (removes from gallery instantly), delete, frames on/off; settings editor for
   everything in the Settings list (with a live preview of the collage footer); export ZIP (queued:
   originals, raw shots, boomerangs in folders + a CSV of names, wishes and album codes).
3. After-wedding mode (toggle): / becomes a thank-you page from the couple leading into the gallery;
   the booth flow is disabled; gallery and albums stay available.
4. /keepsake (keepsake PIN, for the couple): every photo and boomerang,
   guestbook view (photo + name + wish + signature, chronological), "Download guestbook PDF" —
   a queued job building an A4 PDF: cover with the arch monogram, names and date, one elegant page per
   guest entry, ending with stats ("312 photos, 48 wishes") — plus "Download everything".
Acceptance: the couple downloads the guestbook PDF and full archive the day after; guests can still
open their albums weeks later.
Then: git commit -m "Phase 9: slideshow, admin, after-wedding mode, keepsake + guestbook PDF"
```

### Phase 10 — Party modules (what makes guests come back to the booth)

```text
Phase 10 — party modules. Each module has an on/off switch in admin settings. Keep every one
tasteful and on-brand (gold line art, Bodoni/Jost), never cartoonish. No printing, no video, no audio
recording.

1. Sticker studio (on the review screen, optional "Add stickers"): drag, pinch-resize and rotate
   stickers on the collage, undo, clear. A curated set of 24 SVG stickers in gold line art + royal
   fills: "Just married", "Mr & Mrs", crown, veil, bow tie, heart frame, champagne glasses, rings,
   doves, sparkles, speech bubbles ("I do!", "Kilig!", "Forever na 'to"), Filipino family badges
   ("Ninong", "Ninang", "Abay", "Team Groom", "Team Bride", "Barkada", "Lola", "Tito", "Tita").
   Stickers are drawn into the final image at full resolution (keep vector → canvas).

2. Who are you? (one tap on the review screen, optional): "Family of the groom", "Family of the bride",
   "Ninong & Ninang", "Barkada", "Workmates", "Entourage", plus optional table number.
   Stored on the capture; gallery filter chips; shown in the keepsake and guestbook PDF sections.
   Slideshow shows a friendly live tally every few slides ("Table 7: 42 photos — can anyone beat them?").

3. Photo challenges: an admin-editable list shown as a card deck on the mode screen ("Take a challenge").
   Defaults: "With someone you just met", "Recreate the couple's first-date pose", "Oldest and youngest
   guest together", "Your whole table in one photo", "Best barong and Filipiniana pose", "With the
   couple's parents", "The most dramatic dip", "Everyone point at the bride", "Tito/Tita dance moves",
   "Your best 'kilig' face". Picking one shows it as the pose prompt and tags the capture; gallery
   filter "Challenges" shows each challenge with its photos; completed challenges get a small gold badge
   on the guest's album ("4 of 10 challenges done").

4. Hearts: guests tap a heart on any gallery photo (one per device per photo, stored with a random
   device id; server rate-limited). "Most loved" sort/filter in the gallery; slideshow shows a
   "Most loved right now" slide every 10 slides; the couple can mark "Couple's favourites" in admin,
   which get a gold crown in the gallery and lead the keepsake page.

5. Couple quiz: "How well do you know Edwin & Jochel?" on the gallery page (guests play on their own
   phones while waiting): 10 admin-editable multiple-choice questions (e.g. where they first met,
   who said "I love you" first), one attempt per device, name required, instant score with a fun
   verdict line. Leaderboard (top 10) on the slideshow every 15 slides and in admin; the top scorer
   is announced on the slideshow when admin taps "Reveal winner".

6. Grand-finale mosaic: admin uploads a photo of the couple; a queued job builds a large mosaic
   (e.g. 60×90 tiles, 6000×9000 px JPEG) of that photo made from every guest collage thumbnail, with
   colour matching and a light 25% overlay of the original so the couple stays recognisable. Admin can
   rebuild it anytime; "Reveal the mosaic" puts a dramatic reveal on the slideshow (tiles flying in,
   then the full picture), and it becomes downloadable in the gallery and keepsake.

7. Virtual backdrops (optional, OFF by default, labelled beta in admin): background replacement with
   MediaPipe Image Segmenter (selfie segmentation) running in the browser; 6 backdrops (Paris at night,
   Santorini, a Philippine beach sunset, a grand ballroom, a starry night, royal blue drapes with gold).
   Only offered on devices that keep ≥ 20 fps; feather the mask edges; never slow down the normal camera.

8. Boomerang frames: 3 frames for boomerangs (Classic 4:5 with footer, Story 9:16, Square 1:1 Feed Post),
   chosen like collage frames.

Acceptance: each module can be switched on/off live; with everything on, a guest still gets from
welcome to camera in 3 taps; gallery, slideshow and keepsake show the new data; Pest + Vitest cover
hearts limits, quiz single attempt, challenge tagging and mosaic job.
Then: git commit -m "Phase 10: stickers, groups, challenges, hearts, quiz, finale mosaic, backdrops"
```

### Phase 11 — PWA, performance, rehearsal, launch

```text
Phase 11 — make it bulletproof. Use react-best-practices and Laravel Boost skills.
1. vite-plugin-pwa: manifest ("Edwin & Jochel Photobooth", navy theme, gold arch icons 192/512 +
   maskable, display standalone, orientation any), precache shell + fonts + layouts, network-first /api,
   never cache POSTs; iOS standalone meta tags; update prompt only for staff, never mid-session.
2. Performance: video element never re-renders during countdown; memoised previews; Web Worker for
   looks; revoke object URLs; release canvases. 50 sessions with the 6-photo frame + 20 boomerangs in
   Chrome DevTools: heap stays flat, no dropped frames during countdown.
3. Load rehearsal: Artisan command that simulates 3 stations uploading 1,000 captures concurrently
   while 200 phones browse the gallery; queue drains, no duplicates, gallery API stays < 200 ms.
4. Accessibility: visible focus, aria-labels, aria-live countdown, reduced motion, contrast.
5. Security: MIME + size validation, uuid keys, rate limits, PINs hashed, hidden captures never
   reachable through the gallery or album APIs.
6. Production + README: build, caches, storage:link, queue worker (supervisor), HTTPS options
   (domain + Let's Encrypt recommended so guests can open albums from home after the wedding;
   Cloudflare Tunnel or mkcert on LAN for venue-only), iPad Guided Access + Add to Home Screen,
   and a DAY-OF CHECKLIST: charge devices, test both cameras per device, set station names, scan a
   test album QR on 3 different phones, check storage space, set after-wedding mode the next morning.
Acceptance: Lighthouse PWA installable, Performance ≥ 90 on welcome; full flow on iPhone Safari,
iPad Safari, Android Chrome, desktop Chrome; rehearsal passes.
Then: git commit -m "Phase 11: PWA, performance, load rehearsal, launch docs"
```

---

## Step 3 — Final review prompt

```text
Act as a strict reviewer AND a picky bride and groom. Check the whole repo against the master prompt
and the quality bar. On real devices verify: front/back switch on iPhone Safari and two Android brands;
mirroring; WYSIWYG accuracy; dim-light front flash; pose prompts and countdown timing for groups;
reload mid-sequence resumes; offline save → upload exactly once into the right album; album QR on
iPhone and Android; gallery search, lightbox swipe and downloads (single + ZIP) on phones; gallery
smooth with 1,500 items; boomerang plays on iPhone and Android;
attract mode; after-wedding mode; all 20 frames (arch, circles, magazine, stamps, wish card render
correctly); stickers saved at full resolution; challenges, hearts, quiz leaderboard and mosaic reveal;
guestbook PDF looks like printed stationery. Flag anything that looks generic or
cheap. List issues by severity, fix them all, rerun Pest + Vitest, then summarise what changed.
```

---

## Notes

- **HTTPS is required** for the camera on phones (except `localhost`). Set it up and test on the real
  venue Wi-Fi before the wedding.
- Do a full rehearsal with friends a week before: 30 minutes, all modes, all devices, everyone
  scanning their album QR on their own phones.
- You already have a working base (`je-photobooth.zip` from earlier). Give it to the agent as a reference:
  "Use the attached project as a reference implementation; rebuild it with the starter kit following
  these prompts."
