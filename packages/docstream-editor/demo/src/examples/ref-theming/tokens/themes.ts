// Each theme is ordinary CSS: host tokens on a wrapper (what a shadcn app already defines),
// plus, where wanted, editor tokens set on `.gb` itself — the wrapper class declares them.
export const THEMES: Record<string, string> = {
  default: `/* No tokens at all: the editor falls back to its neutral defaults —
   here it inherits the docs site's own tokens. */`,
  brand: `.theme-brand {
  --card: #fbfaff;
  --background: #fbfaff;
  --foreground: #1e1b4b;
  --border: #ddd6fe;
  --muted: #f3f0ff;
  --muted-foreground: #6d5fae;
  --accent: #ede9fe;
  --accent-foreground: #3b0764;
  --primary: #7c3aed;
}`,
  midnight: `.theme-midnight {
  color-scheme: dark;
  --card: #0b1020;
  --background: #0b1020;
  --foreground: #e2e8f0;
  --border: #1e293b;
  --muted: #111827;
  --muted-foreground: #94a3b8;
  --accent: #1e293b;
  --accent-foreground: #f8fafc;
  --primary: #38bdf8;
}`,
  paper: `.theme-paper {
  --card: #fffdf7;
  --background: #fffdf7;
  --foreground: #292524;
  --border: #e7e5e4;
  --muted: #f5f5f4;
  --muted-foreground: #78716c;
  --primary: #b45309;
}
/* Editor tokens live on .gb, so override them there. */
.theme-paper .gb {
  --gb-radius: 4px;
  --gb-info: #0f766e;
  --gb-info-border: rgba(15, 118, 110, 0.45);
  --gb-info-bg: rgba(15, 118, 110, 0.08);
}`,
}
