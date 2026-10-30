'use client';

import React, { useMemo, useRef, useState } from 'react';
import { FiSearch, FiClock, FiSmile, FiHeart, FiFlag } from 'react-icons/fi';

/**
 * Self-contained emoji picker (RingCentral-style, screenshot 14).
 * Search · frequently-used (localStorage) · category tabs · skin tone · keep-open.
 * No external dependency — curated dataset, native emoji glyphs.
 */

const RECENT_KEY = 'nx-emoji-recent';
const SKIN_TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
// Base emoji that accept a Fitzpatrick skin-tone modifier.
const SKIN_BASE = new Set([
  '👍','👎','👌','✋','🙌','👏','🙏','💪','👋','✌','🤞','👈','👉','👆','👇','☝','🤙','🤛','🤜','👊','✊','🖐','🤚','🖖','🤟','🤘','👐','🤲','🤳','🙋','🤦','🤷','💅','🫰','🫶',
]);

interface EmojiDef { c: string; n: string }
function defs(entries: string): EmojiDef[] {
  return entries
    .trim()
    .split('\n')
    .map((l) => {
      const [c, ...n] = l.trim().split(' ');
      return { c, n: n.join(' ') };
    })
    .filter((e) => e.c);
}

const CATEGORIES: { key: string; label: string; icon: React.ReactNode; data: EmojiDef[] }[] = [
  {
    key: 'smileys',
    label: 'Smileys and people',
    icon: <FiSmile className="w-[18px] h-[18px]" />,
    data: defs(`
😀 grin smile happy
😃 smile happy joy
😄 smile happy laugh
😁 grin beam happy
😆 laugh happy squint
😅 sweat laugh nervous
🤣 rofl rolling laugh
😂 joy tears laugh
🙂 slight smile
🙃 upside down silly
😉 wink
😊 blush smile happy
😇 innocent halo angel
🥰 love hearts adore
😍 heart eyes love
🤩 star struck excited
😘 kiss blow love
😗 kiss
😚 kiss closed eyes
😋 yum tasty savor
😛 tongue playful
😜 wink tongue
🤪 zany goofy crazy
😝 tongue squint
🤗 hug hands
🤔 thinking hmm
🤐 zipper quiet
😐 neutral meh
😑 expressionless
😶 no mouth silent
😏 smirk sly
😒 unamused annoyed
🙄 eye roll
😬 grimace awkward
😴 sleep zzz tired
😌 relieved calm
😔 pensive sad
😪 sleepy
😷 mask sick
🤒 sick thermometer
🤕 hurt bandage
🤢 nauseated sick
🤮 vomit sick
🥵 hot heat sweat
🥶 cold freeze
😵 dizzy
🤯 mind blown shocked
😎 cool sunglasses
🤓 nerd geek
😕 confused
😟 worried
🙁 frown sad
😮 open mouth wow
😯 surprised hushed
😲 astonished shocked
😳 flushed embarrassed
🥺 pleading puppy eyes
😢 cry sad tear
😭 sob cry sad
😤 huff triumph
😠 angry mad
😡 rage furious
🤬 cursing swear
😈 devil smirk
👍 thumbs up like yes
👎 thumbs down dislike no
👌 ok perfect
✌ peace victory
🤞 fingers crossed hope
🤟 love you
🤙 call me shaka
👋 wave hi hello bye
🙌 raise hands celebrate
👏 clap applause
🙏 pray thanks please
💪 muscle strong flex
🤝 handshake deal
✊ fist power
👊 punch fist bump
❤️ heart love red
🔥 fire lit hot
`),
  },
  {
    key: 'animals',
    label: 'Animals and nature',
    icon: <span className="text-[17px] leading-none">🐶</span>,
    data: defs(`
🐶 dog puppy
🐱 cat kitten
🐭 mouse
🐹 hamster
🐰 rabbit bunny
🦊 fox
🐻 bear
🐼 panda
🐨 koala
🐯 tiger
🦁 lion
🐮 cow
🐷 pig
🐸 frog
🐵 monkey
🐔 chicken
🐧 penguin
🐦 bird
🦄 unicorn
🐝 bee
🦋 butterfly
🐢 turtle
🐙 octopus
🐠 fish
🐬 dolphin
🐳 whale
🌸 blossom flower
🌹 rose flower
🌻 sunflower
🌲 tree evergreen
🌵 cactus
🍀 clover luck
⭐ star
🌙 moon
☀️ sun
`),
  },
  {
    key: 'food',
    label: 'Food and drink',
    icon: <span className="text-[17px] leading-none">🍎</span>,
    data: defs(`
🍎 apple
🍌 banana
🍇 grapes
🍓 strawberry
🍑 peach
🍒 cherry
🍉 watermelon
🍕 pizza
🍔 burger
🍟 fries
🌭 hotdog
🌮 taco
🍣 sushi
🍜 noodles ramen
🍝 pasta
🍦 icecream
🍩 donut
🍪 cookie
🎂 cake birthday
🍫 chocolate
🍿 popcorn
☕ coffee
🍵 tea
🍺 beer
🍷 wine
🥤 soda drink
🧋 boba tea
🥂 cheers celebrate clink
`),
  },
  {
    key: 'activity',
    label: 'Activity',
    icon: <span className="text-[17px] leading-none">🏀</span>,
    data: defs(`
⚽ soccer football
🏀 basketball
🏈 football
⚾ baseball
🎾 tennis
🏐 volleyball
🎱 pool 8ball
🏓 pingpong
🏸 badminton
🥅 goal
🏆 trophy win
🥇 gold medal
🎯 target bullseye
🎮 game controller
🎲 dice
🎸 guitar music
🎤 mic sing
🎧 headphones
🎨 art paint
🎬 movie clapper
🎉 party celebrate tada
🎊 confetti
🎈 balloon
🎁 gift present
`),
  },
  {
    key: 'travel',
    label: 'Travel and places',
    icon: <span className="text-[17px] leading-none">🚗</span>,
    data: defs(`
🚗 car
🚕 taxi
🚙 suv
🚌 bus
🏎️ race car
🚓 police car
🚑 ambulance
🚒 fire truck
🚚 truck
✈️ plane
🚀 rocket
🚁 helicopter
🚢 ship
⛵ sailboat
🚲 bike
🛵 scooter
🏍️ motorcycle
🗺️ map
🗽 statue liberty
🗼 tower
🏰 castle
🏖️ beach
🏔️ mountain
🌋 volcano
🏙️ city
🌃 night city
`),
  },
  {
    key: 'objects',
    label: 'Objects',
    icon: <span className="text-[17px] leading-none">💡</span>,
    data: defs(`
💡 idea bulb light
🔦 flashlight
🔋 battery
💻 laptop computer
🖥️ desktop
⌨️ keyboard
🖱️ mouse
📱 phone mobile
☎️ telephone
📞 phone call
📷 camera
📸 camera flash
🎥 video camera
📺 tv
📻 radio
⏰ alarm clock
⌚ watch
💰 money bag
💵 dollar money
💳 card credit
✏️ pencil
📝 memo note
📌 pin
📎 paperclip
🔒 lock
🔑 key
🔨 hammer tool
🔧 wrench
🧲 magnet
💊 pill medicine
🔔 bell
📣 megaphone
`),
  },
  {
    key: 'symbols',
    label: 'Symbols',
    icon: <FiHeart className="w-[18px] h-[18px]" />,
    data: defs(`
❤️ heart red love
🧡 orange heart
💛 yellow heart
💚 green heart
💙 blue heart
💜 purple heart
🖤 black heart
🤍 white heart
💔 broken heart
❣️ heart exclamation
💯 hundred perfect
✅ check yes done
❌ cross no wrong
⭕ circle
❗ exclamation
❓ question
⚠️ warning
🚫 no prohibited
♻️ recycle
🔴 red circle
🟢 green circle
🔵 blue circle
⚫ black circle
⚪ white circle
🟠 orange circle
✔️ check mark
➕ plus add
➖ minus
✖️ multiply
💲 dollar sign
🔞 no under 18
`),
  },
  {
    key: 'flags',
    label: 'Flags',
    icon: <FiFlag className="w-[18px] h-[18px]" />,
    data: defs(`
🏁 checkered finish
🚩 triangle flag
🏳️ white flag
🏴 black flag
🏳️‍🌈 rainbow pride
🇺🇸 usa america united states
🇬🇧 uk britain united kingdom
🇨🇦 canada
🇵🇰 pakistan
🇮🇳 india
🇦🇺 australia
🇩🇪 germany
🇫🇷 france
🇯🇵 japan
🇨🇳 china
🇧🇷 brazil
🇲🇽 mexico
🇪🇸 spain
🇮🇹 italy
`),
  },
];

// Frequently-used seed (matches the screenshot's top row) until the user builds their own.
const SEED_RECENT = ['👍', '❤️', '👏', '✔️', '😂', '😎', '🤝', '😮', '🤔'];

function loadRecent(): string[] {
  if (typeof window === 'undefined') return SEED_RECENT;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return SEED_RECENT;
}

export function EmojiPicker({
  onPick,
  keepOpen,
  onKeepOpenChange,
}: {
  onPick: (emoji: string) => void;
  keepOpen: boolean;
  onKeepOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<'recent' | string>('recent');
  const [tone, setTone] = useState(0);
  const [toneOpen, setToneOpen] = useState(false);
  // Lazy init from localStorage — the picker is client-only (portal, opens on
  // click), so there's no SSR hydration mismatch to guard against.
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const scrollRef = useRef<HTMLDivElement>(null);

  const applyTone = (c: string): string => {
    const base = c.replace('️', '');
    if (tone > 0 && SKIN_BASE.has(base)) return base + SKIN_TONES[tone];
    return c;
  };

  const pick = (c: string) => {
    const emoji = applyTone(c);
    onPick(emoji);
    const next = [c, ...recent.filter((r) => r !== c)].slice(0, 18);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const seen = new Set<string>();
    const out: EmojiDef[] = [];
    for (const cat of CATEGORIES) {
      for (const e of cat.data) {
        if ((e.n.includes(q) || e.c === q) && !seen.has(e.c)) {
          seen.add(e.c);
          out.push(e);
        }
      }
    }
    return out;
  }, [query]);

  const scrollToCat = (key: string) => {
    setActiveCat(key);
    const el = scrollRef.current?.querySelector(`[data-cat="${key}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderGrid = (items: EmojiDef[]) => (
    <div className="grid grid-cols-8 gap-0.5">
      {items.map((e, i) => (
        <button
          key={`${e.c}-${i}`}
          type="button"
          onClick={() => pick(e.c)}
          title={e.n}
          className="h-9 w-9 grid place-items-center rounded-lg text-[20px] leading-none hover:bg-[var(--muted)] transition-colors"
        >
          {applyTone(e.c)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-[340px] max-w-[90vw] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden flex flex-col">
      {/* search */}
      <div className="p-3 pb-2">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 focus-within:border-[var(--border)]">
          <FiSearch className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Emoji"
            className="nx-search-input flex-1 bg-transparent outline-none text-sm text-[var(--foreground)]"
          />
        </div>
      </div>

      {/* body */}
      <div ref={scrollRef} className="px-3 h-[240px] overflow-y-auto">
        {searchResults ? (
          searchResults.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted-foreground)] py-8">No emoji found</p>
          ) : (
            renderGrid(searchResults)
          )
        ) : (
          <>
            {recent.length > 0 && (
              <div data-cat="recent" className="mb-2">
                <p className="text-[12px] font-bold text-[var(--muted-foreground)] mb-1 sticky top-0 bg-[var(--card)] py-1">
                  Frequently used
                </p>
                {renderGrid(recent.map((c) => ({ c, n: '' })))}
              </div>
            )}
            {CATEGORIES.map((cat) => (
              <div data-cat={cat.key} key={cat.key} className="mb-2">
                <p className="text-[12px] font-bold text-[var(--muted-foreground)] mb-1 sticky top-0 bg-[var(--card)] py-1">
                  {cat.label}
                </p>
                {renderGrid(cat.data)}
              </div>
            ))}
          </>
        )}
      </div>

      {/* category tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => scrollToCat('recent')}
          title="Frequently used"
          className={`grid place-items-center h-8 w-8 rounded-lg relative ${activeCat === 'recent' ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
        >
          <FiClock className="w-[18px] h-[18px]" />
          {activeCat === 'recent' && <span className="absolute -bottom-1 left-1.5 right-1.5 h-[2px] rounded bg-[var(--primary-600)]" />}
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => scrollToCat(cat.key)}
            title={cat.label}
            className={`grid place-items-center h-8 w-8 rounded-lg relative ${activeCat === cat.key ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
          >
            {cat.icon}
            {activeCat === cat.key && <span className="absolute -bottom-1 left-1.5 right-1.5 h-[2px] rounded bg-[var(--primary-600)]" />}
          </button>
        ))}
      </div>

      {/* footer — keep open + skin tone */}
      <div className="flex items-center justify-between px-3 py-2.5 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => onKeepOpenChange(!keepOpen)}
          className="flex items-center gap-2"
          aria-pressed={keepOpen}
        >
          <span className={`relative w-9 h-5 rounded-full transition-colors ${keepOpen ? 'bg-[var(--primary-600)]' : 'bg-[var(--border)]'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${keepOpen ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
          <span className="text-[13px] text-[var(--foreground)]">Keep open</span>
        </button>

        <div className="relative flex items-center gap-2">
          <span className="text-[13px] text-[var(--muted-foreground)]">Skin tone:</span>
          <button
            type="button"
            onClick={() => setToneOpen((v) => !v)}
            title="Change skin tone"
            className="text-[18px] leading-none h-7 w-7 grid place-items-center rounded-lg hover:bg-[var(--muted)]"
          >
            {'👍'.replace('️', '') + SKIN_TONES[tone]}
          </button>
          {toneOpen && (
            <>
              <div className="fixed inset-0 z-[70]" onClick={() => setToneOpen(false)} />
              <div className="absolute bottom-full right-0 mb-1 z-[71] flex gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-1">
                {SKIN_TONES.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setTone(i); setToneOpen(false); }}
                    className={`text-[18px] leading-none h-7 w-7 grid place-items-center rounded-lg hover:bg-[var(--muted)] ${i === tone ? 'bg-[var(--muted)]' : ''}`}
                  >
                    {'👍' + t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmojiPicker;
