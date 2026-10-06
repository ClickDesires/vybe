export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim(n / 1000)}K`;
  if (n < 1_000_000_000) return `${trim(n / 1_000_000)}M`;
  return `${trim(n / 1_000_000_000)}B`;
}

function trim(n: number) {
  return n >= 100 ? Math.floor(n).toString() : n.toFixed(1).replace(/\.0$/, '');
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 52) return `${w}w`;
  return `${Math.floor(d / 365)}y`;
}

/** Splits a caption into plain text and #hashtag / @mention tokens. */
export function tokenizeCaption(caption: string) {
  return caption.split(/([#@][\w.]+)/g).filter(Boolean).map((text) => ({
    text,
    kind: text.startsWith('#') ? ('tag' as const) : text.startsWith('@') ? ('mention' as const) : ('text' as const),
  }));
}
