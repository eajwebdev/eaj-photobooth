<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Guestbook of {{ $couple['short'] }}</title>
    <style>
        @font-face { font-family: 'Bodoni Moda'; font-style: normal; font-weight: 400; src: url('{{ $fonts }}/BodoniModa-Regular.ttf') format('truetype'); }
        @font-face { font-family: 'Bodoni Moda'; font-style: italic; font-weight: 400; src: url('{{ $fonts }}/BodoniModa-Italic.ttf') format('truetype'); }
        @font-face { font-family: 'Jost'; font-style: normal; font-weight: 400; src: url('{{ $fonts }}/Jost-Regular.ttf') format('truetype'); }
        @font-face { font-family: 'Jost'; font-style: normal; font-weight: 500; src: url('{{ $fonts }}/Jost-Medium.ttf') format('truetype'); }

        @page { margin: 0; size: A4; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Jost', sans-serif; color: #0C1C45; }

        /* Each page: white paper with the gold double rule of the suite. */
        .page { position: relative; width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; }
        .page:last-child { page-break-after: auto; }
        .rule-outer { position: absolute; top: 9mm; left: 9mm; right: 9mm; bottom: 9mm; border: 0.9mm solid #C9A14A; }
        .rule-inner { position: absolute; top: 12mm; left: 12mm; right: 12mm; bottom: 12mm; border: 0.3mm solid #C9A14A; }
        .content { position: absolute; top: 22mm; left: 22mm; right: 22mm; bottom: 22mm; text-align: center; }

        .display { font-family: 'Bodoni Moda', serif; }
        .italic { font-style: italic; }
        .gold { color: #A07C2C; }
        .royal { color: #1F3F95; }
        .eyebrow { font-size: 12pt; }
        .spaced { letter-spacing: 0.18em; font-weight: 500; }

        .ornament { margin: 6mm auto; width: 60mm; height: 4mm; position: relative; }
        .ornament .line { position: absolute; top: 1.8mm; width: 26mm; border-top: 0.3mm solid #C9A14A; }
        .ornament .left { left: 0; }
        .ornament .right { right: 0; }
        .ornament .diamond { position: absolute; left: 28.6mm; top: 0.4mm; width: 2.6mm; height: 2.6mm; background: #C9A14A; transform: rotate(45deg); }

        /* Cover */
        .arch { margin: 18mm auto 0; width: 62mm; height: 78mm; position: relative; }
        .arch img { width: 62mm; height: 78mm; }
        .arch .letters { position: absolute; top: 19mm; left: 0; right: 0; font-size: 34pt; color: #A07C2C; }
        .arch .letters .amp { font-size: 20pt; font-style: italic; }
        .cover-title { font-size: 15pt; margin-top: 12mm; }
        .cover-names { font-size: 34pt; line-height: 1.15; margin-top: 3mm; }
        .cover-amp { font-size: 22pt; color: #C9A14A; }

        /* Entry pages */
        .photo { height: 150mm; margin: 4mm auto 0; text-align: center; }
        .photo img { max-height: 150mm; max-width: 150mm; border: 0.25mm solid #E8D29B; }
        .wish { font-size: 19pt; line-height: 1.05; margin: 9mm 6mm 0; }
        .name { font-size: 13pt; margin-top: 5mm; }
        .meta { font-size: 9pt; color: #5d6785; margin-top: 2mm; }
        .signature { margin-top: 5mm; height: 24mm; }
        .signature img { max-height: 24mm; max-width: 90mm; }

        /* Closing */
        .stat { font-size: 40pt; line-height: 1.1; }
        .stat-label { font-size: 12pt; margin-bottom: 8mm; }
    </style>
</head>
<body>
    {{-- Cover --}}
    <div class="page">
        <div class="rule-outer"></div>
        <div class="rule-inner"></div>
        <div class="content">
            <div class="arch">
                <img src="data:image/svg+xml;base64,{{ base64_encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300"><path d="M120 14 L127 23 L120 32 L113 23 Z" fill="#C9A14A"/><path d="M24 292 V128 A96 96 0 0 1 216 128 V292 Z" fill="none" stroke="#C9A14A" stroke-width="2.6"/><path d="M36 282 V128 A84 84 0 0 1 204 128 V282 Z" fill="none" stroke="#C9A14A" stroke-width="1"/><path d="M84 236 H112 M128 236 H156" stroke="#C9A14A" stroke-width="1"/></svg>') }}" alt="">
                <div class="letters display">E <span class="amp">&amp;</span> J</div>
            </div>
            <div class="cover-title display italic gold">The guestbook of</div>
            <div class="cover-names display italic">
                {{ $couple['groom'] }}<br>
                <span class="cover-amp">&amp;</span><br>
                {{ $couple['bride'] }}
            </div>
            <div class="ornament"><span class="line left"></span><span class="diamond"></span><span class="line right"></span></div>
            @if ($date)
                <div class="eyebrow spaced gold">{{ $date }}</div>
            @endif
            @if ($venue)
                <div class="eyebrow" style="margin-top: 2mm;">{{ $venue }}</div>
            @endif
        </div>
    </div>

    {{-- One page per guest --}}
    @foreach ($entries as $entry)
        <div class="page">
            <div class="rule-outer"></div>
            <div class="rule-inner"></div>
            <div class="content">
                @if ($entry['image'])
                    <div class="photo"><img src="{{ $entry['image'] }}" alt=""></div>
                @endif

                @if ($entry['message'])
                    <div class="wish display italic">&ldquo;{{ $entry['message'] }}&rdquo;</div>
                @endif

                @if ($entry['name'])
                    <div class="name royal spaced">{{ $entry['name'] }}</div>
                @endif

                @if ($entry['signature'])
                    <div class="signature"><img src="{{ $entry['signature'] }}" alt=""></div>
                @endif

                <div class="meta">
                    {{ collect([$entry['group'], $entry['table'] ? 'Table '.$entry['table'] : null, $entry['time']])->filter()->join(', ') }}
                </div>
            </div>
        </div>
    @endforeach

    {{-- Closing --}}
    <div class="page">
        <div class="rule-outer"></div>
        <div class="rule-inner"></div>
        <div class="content" style="top: 70mm;">
            <div class="display italic gold" style="font-size: 20pt;">With love from everyone who came</div>
            <div class="ornament"><span class="line left"></span><span class="diamond"></span><span class="line right"></span></div>
            <div class="stat display">{{ number_format($stats['photos']) }}</div>
            <div class="stat-label spaced gold">{{ $stats['photos'] === 1 ? 'photo' : 'photos' }}</div>
            <div class="stat display">{{ number_format($stats['wishes']) }}</div>
            <div class="stat-label spaced gold">{{ $stats['wishes'] === 1 ? 'wish' : 'wishes' }}</div>
            @if ($thanks)
                <div class="display italic" style="font-size: 14pt; line-height: 1.1; margin: 6mm 12mm 0;">{{ $thanks }}</div>
            @endif
            @if ($hashtag)
                <div class="gold" style="margin-top: 8mm;">{{ $hashtag }}</div>
            @endif
        </div>
    </div>
</body>
</html>
