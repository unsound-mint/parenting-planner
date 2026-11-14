/** A flat folder with papers and a stamp, in the comp's palette. Decorative; the sheets lift a little on hover. */
export function PaperworkArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 180" className={className} aria-hidden fill="none">
      <ellipse cx="110" cy="165" rx="82" ry="8" fill="#000" opacity="0.06" />
      <g className="pp-sheet">
        <rect x="52" y="22" width="104" height="124" rx="10" fill="#fffaf0" stroke="#e4d9c3" strokeWidth="2" transform="rotate(-6 104 84)" />
      </g>
      <rect x="62" y="18" width="104" height="124" rx="10" fill="#fff" stroke="#e4d9c3" strokeWidth="2" transform="rotate(3 114 80)" />
      <g transform="rotate(3 114 80)" stroke="#d8cdb6" strokeWidth="5" strokeLinecap="round">
        <path d="M80 44h56M80 60h68M80 76h44" />
      </g>
      <path d="M26 74a12 12 0 0 1 12-12h42l14 14h76a12 12 0 0 1 12 12v62a12 12 0 0 1-12 12H38a12 12 0 0 1-12-12z" fill="#f2b84b" />
      <path d="M26 96h168v52a12 12 0 0 1-12 12H38a12 12 0 0 1-12-12z" fill="#f7c966" />
      <circle cx="156" cy="126" r="20" fill="#3f6b37" />
      <path d="m147 126 7 7 12-14" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
