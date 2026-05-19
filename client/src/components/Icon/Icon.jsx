const icons = {
  activity: (
    <>
      <path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </>
  ),
  barChart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-4" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5a3 3 0 0 0-5.7-1.3A3.5 3.5 0 0 0 3.5 9a3.5 3.5 0 0 0 .4 6.7A3 3 0 0 0 9 20.8V5a3 3 0 0 1 3 0Z" />
      <path d="M12 5a3 3 0 0 1 5.7-1.3A3.5 3.5 0 0 1 20.5 9a3.5 3.5 0 0 1-.4 6.7A3 3 0 0 1 15 20.8V5a3 3 0 0 0-3 0Z" />
      <path d="M9 9H7.5" />
      <path d="M16.5 9H15" />
      <path d="M9 14H7" />
      <path d="M17 14h-2" />
    </>
  ),
  bookOpen: (
    <>
      <path d="M12 7v14" />
      <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 1 3 18.5z" />
      <path d="M12 3h6.5A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5H12z" />
    </>
  ),
  checkCircle: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </>
  ),
  circleDashed: (
    <>
      <path d="M10.1 2.18a10 10 0 0 1 3.8 0" />
      <path d="M17.6 3.72a10 10 0 0 1 2.68 2.68" />
      <path d="M21.82 10.1a10 10 0 0 1 0 3.8" />
      <path d="M20.28 17.6a10 10 0 0 1-2.68 2.68" />
      <path d="M13.9 21.82a10 10 0 0 1-3.8 0" />
      <path d="M6.4 20.28a10 10 0 0 1-2.68-2.68" />
      <path d="M2.18 13.9a10 10 0 0 1 0-3.8" />
      <path d="M3.72 6.4A10 10 0 0 1 6.4 3.72" />
    </>
  ),
  crown: (
    <>
      <path d="m2 6 5 4 5-7 5 7 5-4-2 13H4z" />
      <path d="M4 19h16" />
    </>
  ),
  flame: (
    <>
      <path d="M8.5 14.5A4.5 4.5 0 0 0 13 19a5 5 0 0 0 5-5c0-3-2-5-4-7 .2 2-1 3-2.2 3.8C10.2 8 10.6 5.5 12 3 7.8 5.3 5 9.1 5 13a7 7 0 0 0 14 0" />
    </>
  ),
  gauge: (
    <>
      <path d="M12 14l4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </>
  ),
  layoutDashboard: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1.5" />
      <rect width="7" height="5" x="14" y="3" rx="1.5" />
      <rect width="7" height="9" x="14" y="12" rx="1.5" />
      <rect width="7" height="5" x="3" y="16" rx="1.5" />
    </>
  ),
  listChecks: (
    <>
      <path d="m3 7 2 2 4-4" />
      <path d="m3 17 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </>
  ),
  medal: (
    <>
      <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .73-2.73L5.13 3.4a2 2 0 0 1 2.73.73L12 11.3" />
      <path d="m16.79 15 4.55-7.86a2 2 0 0 0-.73-2.73L18.87 3.4a2 2 0 0 0-2.73.73L12 11.3" />
      <circle cx="12" cy="17" r="5" />
    </>
  ),
  notebookPen: (
    <>
      <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4" />
      <path d="M2 6h4" />
      <path d="M2 10h4" />
      <path d="M2 14h4" />
      <path d="M2 18h4" />
      <path d="m14 15 7-7-3-3-7 7-1 4z" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1 1-1.5 2.5-1.5 4.5 2 0 3.5-.5 4.5-1.5" />
      <path d="M9 15 7 17a2.83 2.83 0 0 1-4-4l2-2" />
      <path d="M15 9l-6 6" />
      <path d="M14 3c2.5-.2 5.3.6 7 2.3-1 4-3.4 7-7 9.7l-5-5C11.7 6.4 14 3 14 3z" />
      <path d="M14 3v6h6" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.73l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.73v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      <path d="m5 15 .8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  trendingUp: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  trophy: (
    <>
      <path d="M6 9H4.5A2.5 2.5 0 0 1 2 6.5V5h4" />
      <path d="M18 9h1.5A2.5 2.5 0 0 0 22 6.5V5h-4" />
      <path d="M6 2h12v7a6 6 0 0 1-12 0z" />
      <path d="M12 15v4" />
      <path d="M8 22h8" />
      <path d="M9 19h6" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </>
  ),
  zap: (
    <>
      <path d="M13 2 3 14h8l-1 8 10-12h-8z" />
    </>
  )
};

export default function Icon({ name, className = '', size = 20, strokeWidth = 2, title }) {
  return (
    <svg
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      className={`icon ${className}`.trim()}
      fill="none"
      height={size}
      role={title ? 'img' : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
    >
      {icons[name] || icons.sparkles}
    </svg>
  );
}
