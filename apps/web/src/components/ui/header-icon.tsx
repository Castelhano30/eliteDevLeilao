/** SVGs locais decorativos: o controle pai fornece o nome acessível. */
export function HeaderIcon({ name, size = 18 }: { name: "sun" | "moon" | "eye" | "eye-off" | "chevron" | "wallet"; size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {name === "sun" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : null}
      {name === "moon" ? <path d="M20 15.4A9 9 0 0 1 8.6 4 9 9 0 1 0 20 15.4Z" /> : null}
      {name === "eye" || name === "eye-off" ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{name === "eye-off" ? <path d="m3 3 18 18" /> : null}</> : null}
      {name === "chevron" ? <path d="m6 9 6 6 6-6" /> : null}
      {name === "wallet" ? <><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M16 13.5h2" /></> : null}
    </svg>
  );
}
