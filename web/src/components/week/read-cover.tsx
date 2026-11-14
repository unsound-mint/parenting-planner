// Flat cover art for a lesson card, one scene per learning path, in the comp's
// palette. Art colours stay inside the SVG (docs/design.md, "Tokens"). A path
// without its own scene gets the hills.

type Scene = (props: { alt: boolean }) => React.ReactNode;

const Hills: Scene = ({ alt }) => (
  <>
    <rect width="300" height="132" fill={alt ? "#FCEBD5" : "#FBE3D5"} />
    <circle cx="230" cy="40" r="26" fill="#F4CD6A" />
    <path d="M0 100c40-20 80-20 120 0s80 20 120 0 60-10 60-10v42H0z" fill="#E8A07C" />
    <path d="M0 116c40-14 80-14 120 0s80 14 120 0 60-8 60-8v24H0z" fill="#A84E2C" opacity=".8" />
    <rect x="40" y="30" width="70" height="52" rx="6" fill="#fff" />
    <path d="M50 44h50M50 54h40M50 64h46" stroke="#E3D6C2" strokeWidth="4" strokeLinecap="round" />
    <path d="M90 68c-4-6-12-4-11 2 1 4 6 7 11 10 5-3 10-6 11-10 1-6-7-8-11-2z" fill="#E07A52" />
  </>
);

const House: Scene = () => (
  <>
    <rect width="300" height="132" fill="#D8EDEB" />
    <circle cx="60" cy="38" r="18" fill="#FFF5E2" />
    <circle cx="68" cy="32" r="16" fill="#D8EDEB" />
    <path d="M120 110V70l40-30 40 30v40z" fill="#fff" />
    <rect x="150" y="84" width="20" height="26" rx="4" fill="#7DBAB6" />
    <path d="M110 74l50-38 50 38" stroke="#1D6A70" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="240" cy="78" r="22" fill="#fff" />
    <path d="M240 64v14l9 6" stroke="#1D6A70" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M0 118h300v14H0z" fill="#7DBAB6" />
  </>
);

const Pair: Scene = () => (
  <>
    <rect width="300" height="132" fill="#E6EFDC" />
    <path d="M0 132c30-40 70-56 110-50s70 30 110 24 60-24 80-30v56z" fill="#B7CFA4" />
    <circle cx="118" cy="62" r="16" fill="#A84E2C" />
    <circle cx="168" cy="58" r="16" fill="#1D6A70" />
    <path d="M104 108c0-20 8-30 14-30s14 10 14 30M154 108c0-20 8-34 14-34s14 14 14 34" fill="#fff" />
    <path d="M134 78c6 4 14 4 20 0" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M232 34l4 8 8 1-6 6 2 8-8-4-8 4 2-8-6-6 8-1z" fill="#F4CD6A" />
  </>
);

const Moon: Scene = () => (
  <>
    <rect width="300" height="132" fill="#E4E8F0" />
    <circle cx="82" cy="46" r="24" fill="#FFF5E2" />
    <circle cx="94" cy="38" r="21" fill="#E4E8F0" />
    <path d="M200 30l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z M250 58l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#F4CD6A" />
    <rect x="120" y="82" width="120" height="34" rx="12" fill="#fff" />
    <rect x="130" y="72" width="38" height="22" rx="9" fill="#FCEBD5" />
    <path d="M0 120h300v12H0z" fill="#CBD3DA" />
  </>
);

const Cup: Scene = () => (
  <>
    <rect width="300" height="132" fill="#FCEBD5" />
    <circle cx="70" cy="44" r="20" fill="#F4CD6A" opacity=".8" />
    <path d="M128 56h52v38a18 18 0 0 1-18 18h-16a18 18 0 0 1-18-18z" fill="#fff" />
    <path d="M180 66h8a12 12 0 0 1 0 24h-8" stroke="#fff" strokeWidth="7" fill="none" />
    <path d="M140 46c0-8 8-8 8-16M158 46c0-8 8-8 8-16" stroke="#E8A07C" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M0 118c50-10 100-10 150 0s100 10 150 0v14H0z" fill="#F7CB92" />
  </>
);

const Coins: Scene = () => (
  <>
    <rect width="300" height="132" fill="#F3E0A6" />
    <rect x="96" y="40" width="108" height="72" rx="10" fill="#fff" />
    <path d="M110 58h50M110 70h70M110 82h40" stroke="#E3D6C2" strokeWidth="4" strokeLinecap="round" />
    <circle cx="214" cy="96" r="18" fill="#F4CD6A" stroke="#8A6414" strokeWidth="3" />
    <circle cx="236" cy="84" r="14" fill="#F4CD6A" stroke="#8A6414" strokeWidth="3" />
    <path d="M0 122h300v10H0z" fill="#E6C774" />
  </>
);

const Cloud: Scene = () => (
  <>
    <rect width="300" height="132" fill="#FAE3D5" />
    <path d="M90 92a22 22 0 0 1 6-43 30 30 0 0 1 56-8 24 24 0 0 1 38 22 18 18 0 0 1-6 29z" fill="#fff" />
    <path d="M150 78c-5-8-16-5-15 3 1 5 8 9 15 13 7-4 14-8 15-13 1-8-10-11-15-3z" fill="#E07A52" />
    <path d="M0 118c60-14 120-14 180 0s80 8 120 0v14H0z" fill="#E8A07C" opacity=".7" />
  </>
);

const Bloom: Scene = () => (
  <>
    <rect width="300" height="132" fill="#E6EFDC" />
    <path d="M150 120V70" stroke="#4F7F45" strokeWidth="5" strokeLinecap="round" />
    <path d="M150 96c-18-2-28-14-26-26 14 0 24 10 26 26zM150 88c16-2 26-12 24-24-12 0-22 10-24 24z" fill="#7FAE63" />
    <circle cx="150" cy="56" r="16" fill="#F4CD6A" />
    <circle cx="150" cy="56" r="7" fill="#E8A040" />
    <path d="M0 120h300v12H0z" fill="#B7CFA4" />
  </>
);

const scenes: Record<string, Scene> = {
  "your-pregnancy": Bloom,
  birth: Hills,
  feeding: Cup,
  "first-weeks": Moon,
  couple: Pair,
  partner: Pair,
  "money-leave": Coins,
  "mental-health": Cloud,
};

const order: Scene[] = [Hills, Pair, Moon, Cup, Cloud, Bloom, Coins];

/**
 * House for anything about getting to the hospital; otherwise the path's
 * scene. index is the card's place in a row: the second and third cards of the
 * same path turn to the next scenes, so a row never shows one picture three times.
 */
export function ReadCover({ pathId, lessonId, index = 0 }: { pathId: string; lessonId: string; index?: number }) {
  const base = scenes[pathId] ?? Hills;
  const Scene = /hospital|time-to-go|labou?r-starts/.test(lessonId) ? House : order[(order.indexOf(base) + index) % order.length];
  return (
    <svg viewBox="0 0 300 132" preserveAspectRatio="xMidYMid slice" className="block size-full" aria-hidden focusable="false">
      <Scene alt={pathId !== "birth"} />
    </svg>
  );
}
