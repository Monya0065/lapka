'use client';

const PATHS = {
  home: 'M4 10.5 12 4l8 6.5v8a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z',
  pets: 'M7.5 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm9 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 9a2.25 2.25 0 1 0 0-4.5A2.25 2.25 0 0 0 12 9Zm0 2c-3.6 0-6.5 1.94-6.5 4.33C5.5 17.36 7.3 19 9.54 19h4.92C16.7 19 18.5 17.36 18.5 15.33 18.5 12.94 15.6 11 12 11Z',
  appointments: 'M7 3v2M17 3v2M4 8h16M6 5h12a2 2 0 0 1 2 2v11H4V7a2 2 0 0 1 2-2Zm2 6h3v3H8zm5 0h3v3h-3z',
  records: 'M7 4h7l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 1.5V9h3.5',
  documents: 'M7 4h10a2 2 0 0 1 2 2v12H5V6a2 2 0 0 1 2-2Zm1.5 4h7m-7 3h7m-7 3h4',
  inpatient: 'M4 9h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm4-5h8v3H8zm3 6v2H9v2h2v2h2v-2h2v-2h-2v-2z',
  pharmacy: 'M6 5h8l4 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm6 1.5V10h3.5M11 12H9v2H7v2h2v2h2v-2h2v-2h-2z',
  knowledge: 'M6 5h8a4 4 0 0 1 4 4v10H8a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0-2 2v12h10',
  care: 'M12 20s-6.5-3.8-6.5-9.2A3.8 3.8 0 0 1 9.3 7a4.5 4.5 0 0 1 2.7.94A4.5 4.5 0 0 1 14.7 7a3.8 3.8 0 0 1 3.8 3.8C18.5 16.2 12 20 12 20Z',
  finance: 'M12 3 4 7v10l8 4 8-4V7zm0 2.2 5.5 2.55L12 10.3 6.5 7.75Z',
  profile: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.01-8 4.5V20h16v-1.5C20 16.01 16.42 14 12 14Z',
  sos: 'M12 3 4 7v5c0 4.97 3.06 9.62 8 11 4.94-1.38 8-6.03 8-11V7zm1 12h-2v-2H9v-2h2V9h2v2h2v2h-2z',
  timeline: 'M6 5h3v14H6zm5 4h3v10h-3zm5-6h3v16h-3z',
  health: 'M10 4h4v4h4v4h-4v4h-4v-4H6V8h4z',
  map: 'M4 7.2 9 4l6 2 5-2v12.8l-5 3-6-2-5 2zM9 6.2v9.6m6-8.8v9.6',
  tools: 'M14.7 5.3a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-7.9 7.9-3.6.9.9-3.6 7.9-7.9ZM5 19h14',
  services: 'M6 6h12v5H6zm-1 7h14v5H5z',
  notifications: 'M12 4a4 4 0 0 0-4 4v1.2c0 .78-.2 1.55-.58 2.24L6 14.5V16h12v-1.5l-1.42-3.06A5.2 5.2 0 0 1 16 9.2V8a4 4 0 0 0-4-4Zm0 16a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 20Z',
};

export default function SidebarIcon({ name, dark = false }) {
  const d = PATHS[name] || PATHS.home;
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center ${dark ? 'text-slate-200' : 'text-lapka-500'}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d={d} />
      </svg>
    </span>
  );
}
