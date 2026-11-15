/** Live flight attitude, with text so color and the moving needle are not essential. */
export function AttitudeIndicator({ angle, label, value }: { angle: number; label: string; value: string }) {
  return <div className="flight-attitude panel" aria-label={`${label}: ${value}`}>
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs><linearGradient id={`attitude-${label}`} x2="0" y2="1"><stop stopColor="#214e72" /><stop offset="0.5" stopColor="#102b42" /><stop offset="0.5" stopColor="#3c3426" /><stop offset="1" stopColor="#171a22" /></linearGradient></defs>
      <circle cx="50" cy="50" r="44" fill={`url(#attitude-${label})`} stroke="#5e7c99" />
      <path d="M8 50H92 M50 8V16 M50 84V92 M18 18L23 23 M77 77L82 82 M18 82L23 77 M77 23L82 18" stroke="#9bb0c9" fill="none" />
      <g transform={`rotate(${angle} 50 50)`}><path d="M50 17L43 32H48V69H52V32H57Z" fill="#ffc46b" /></g>
      <circle cx="50" cy="50" r="3" fill="#eaf6ff" />
    </svg>
    <span className="meter-label">{label}</span><strong className="mono">{value}</strong>
  </div>;
}
