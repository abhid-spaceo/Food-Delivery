// Format integer cents as a USD string (e.g. 1300 -> "$13.00"). Money is always
// integer cents in this codebase (see CLAUDE.md) — never divide into floats for storage.
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
