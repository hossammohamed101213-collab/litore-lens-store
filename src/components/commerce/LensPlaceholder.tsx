/** Drawn placeholder for a lens until real product photos exist. */
export function LensPlaceholder({ color, label }: { color: string; label: string }) {
  const id = `g-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={label} className="size-full">
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2b1d22" />
          <stop offset="28%" stopColor="#2b1d22" />
          <stop offset="30%" stopColor={color} stopOpacity="0.55" />
          <stop offset="70%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill="#fff" />
      <circle cx="100" cy="100" r="64" fill={`url(#${id})`} stroke="#C7A16A" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="74" fill="none" stroke="#C7A16A" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 5" />
      <circle cx="82" cy="82" r="9" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}
