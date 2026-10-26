// Logo for the public product (working name Project Hawkeye): a target with an arrow in the center.
export default function HawkeyeMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="hawkeye-mark">
      <circle cx="16" cy="16" r="14" fill="var(--header)" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="var(--brand)" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="4" fill="var(--brand)" />
      <path d="M16 16 L27 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M23.5 4.5 L27.5 4.5 L27.5 8.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
