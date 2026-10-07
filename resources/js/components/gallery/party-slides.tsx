import { GoldOrnament } from '@/components/chapel/gold-ornament';
import type { PartyState } from '@/lib/party';
import { Heart } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

export type PartySlideKind = 'tally' | 'loved' | 'leaderboard' | 'winner' | 'mosaic';

export const PARTY_SLIDE_MS: Record<PartySlideKind, number> = {
    tally: 8000,
    loved: 9000,
    leaderboard: 10000,
    winner: 14000,
    mosaic: 18000,
};

function Title({ children }: { children: string }) {
    return (
        <>
            <h2 className="font-display text-gold-light text-[clamp(2.4rem,5vw,5rem)] leading-tight italic">{children}</h2>
            <GoldOrnament width="w-24" className="my-[2vh]" />
        </>
    );
}

/** A party moment on the projector between photos. */
export function PartySlide({ kind, state }: { kind: PartySlideKind; state: PartyState }) {
    if (kind === 'tally' && state.tallies) {
        const [topTable] = state.tallies.tables;
        const [topGroup] = state.tallies.groups;

        return (
            <div className="flex h-full flex-col items-center justify-center gap-[2vh] text-center">
                <Title>The photo race</Title>
                {topTable && (
                    <p className="font-display text-mist text-[clamp(2rem,4vw,4.2rem)] leading-tight italic">
                        Table {topTable.table}: {topTable.photos} photos.
                        <br />
                        Can anyone beat them?
                    </p>
                )}
                <ul className="mt-[3vh] flex flex-wrap justify-center gap-x-[3vw] gap-y-[1.5vh]">
                    {(topTable ? state.tallies.tables.slice(1, 5) : []).map((row) => (
                        <li key={row.table} className="text-mist/80 text-[clamp(1rem,1.6vw,1.8rem)]">
                            Table {row.table}: <span className="text-gold-light">{row.photos}</span>
                        </li>
                    ))}
                    {topGroup && (
                        <li className="text-mist/80 text-[clamp(1rem,1.6vw,1.8rem)]">
                            {topGroup.label}: <span className="text-gold-light">{topGroup.photos}</span>
                        </li>
                    )}
                </ul>
            </div>
        );
    }

    if (kind === 'loved') {
        return (
            <div className="flex h-full flex-col items-center justify-center text-center">
                <Title>Most loved right now</Title>
                <ul className="grid max-h-[62vh] grid-cols-3 gap-[1.5vw]">
                    {state.most_loved.slice(0, 3).map((capture, index) => (
                        <li key={capture.uuid} className="flex flex-col items-center gap-[1vh]">
                            <img src={capture.urls.preview} alt="" className="max-h-[52vh] w-auto shadow-[0_20px_50px_rgb(0_0_0/0.5)]" />
                            <p className="text-mist flex items-center gap-2 text-[clamp(1rem,1.4vw,1.6rem)]">
                                <span className="text-gold-light font-display italic">{index + 1}.</span>
                                <Heart className="size-[1.2em] text-[#f3a6b4]" fill="currentColor" /> {capture.hearts_count}
                                {capture.guest_name && <span className="text-mist/75">, {capture.guest_name}</span>}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    if ((kind === 'leaderboard' || kind === 'winner') && state.leaderboard) {
        const [winner] = state.leaderboard.top;

        if (kind === 'winner' && winner) {
            return (
                <div className="flex h-full flex-col items-center justify-center text-center">
                    <Title>And the quiz winner is</Title>
                    <motion.p
                        className="font-display text-mist text-[clamp(4rem,9vw,10rem)] leading-none italic"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1.2, type: 'spring', stiffness: 120, damping: 12 }}
                    >
                        {winner.name}
                    </motion.p>
                    <motion.p
                        className="text-gold-light mt-[3vh] text-[clamp(1.4rem,2.4vw,2.8rem)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.2 }}
                    >
                        {winner.score} out of {state.leaderboard.total}. Congratulations!
                    </motion.p>
                </div>
            );
        }

        return (
            <div className="flex h-full flex-col items-center justify-center text-center">
                <Title>How well do you know the couple?</Title>
                <ol className="w-[min(46vw,40rem)]">
                    {state.leaderboard.top.slice(0, 10).map((leader, position) => (
                        <li
                            key={`${leader.name}-${position}`}
                            className="border-gold-light/15 flex justify-between border-b py-[0.9vh] text-[clamp(1.1rem,1.7vw,2rem)]"
                        >
                            <span className="text-mist">
                                <span className="text-gold-light font-display mr-3 italic">{position + 1}.</span>
                                {leader.name}
                            </span>
                            <span className="text-gold-light">
                                {leader.score}/{state.leaderboard?.total}
                            </span>
                        </li>
                    ))}
                </ol>
                <p className="text-mist/70 mt-[3vh] text-[clamp(1rem,1.3vw,1.5rem)]">Play on your phone: scan the code and tap “Take the quiz”.</p>
            </div>
        );
    }

    if (kind === 'mosaic' && state.mosaic) {
        return <MosaicReveal src={state.mosaic.preview} />;
    }

    return null;
}

const COLS = 8;
const ROWS = 12;

/** Tiles fly in from everywhere and settle into the mosaic, then the whole picture glows in. */
function MosaicReveal({ src }: { src: string }) {
    const reduceMotion = useReducedMotion();
    const tiles = useMemo(
        () =>
            Array.from({ length: COLS * ROWS }, (_, index) => ({
                index,
                x: (Math.random() - 0.5) * 160,
                y: (Math.random() - 0.5) * 160,
                rotate: (Math.random() - 0.5) * 90,
                delay: Math.random() * 3.2,
            })),
        [],
    );

    return (
        <div className="flex h-full flex-col items-center justify-center gap-[2vh] text-center">
            <div className="relative aspect-[2/3] h-[78vh]">
                {!reduceMotion &&
                    tiles.map((tile) => (
                        <motion.span
                            key={tile.index}
                            className="absolute"
                            style={{
                                left: `${((tile.index % COLS) / COLS) * 100}%`,
                                top: `${(Math.floor(tile.index / COLS) / ROWS) * 100}%`,
                                width: `${100 / COLS}%`,
                                height: `${100 / ROWS}%`,
                                backgroundImage: `url(${src})`,
                                backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
                                backgroundPosition: `${((tile.index % COLS) / (COLS - 1)) * 100}% ${(Math.floor(tile.index / COLS) / (ROWS - 1)) * 100}%`,
                            }}
                            initial={{ opacity: 0, x: `${tile.x}vw`, y: `${tile.y}vh`, rotate: tile.rotate, scale: 0.4 }}
                            animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
                            transition={{ delay: tile.delay, duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                        />
                    ))}
                <motion.img
                    src={src}
                    alt="The grand-finale mosaic"
                    className="absolute inset-0 size-full shadow-[0_30px_80px_rgb(0_0_0/0.6)]"
                    initial={{ opacity: reduceMotion ? 1 : 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduceMotion ? 0 : 5.4, duration: 1.6 }}
                />
            </div>
            <motion.p
                className="font-display text-gold-light text-[clamp(1.4rem,2.4vw,2.8rem)] italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 6.5 }}
            >
                One picture, made from every photo you took tonight
            </motion.p>
        </div>
    );
}
