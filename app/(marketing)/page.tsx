import Link from "next/link";
import { Zap, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Full branded landing page for QwikBite.
// Three sections: hero (gradient band + dual CTA), feature tiles, footer.
// No placeholder text — real product copy throughout.
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Nav bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground"
          >
            <span
              className="grid size-8 place-items-center rounded-xl text-sm font-bold text-white"
              style={{ background: "var(--gradient-brand)" }}
              aria-hidden="true"
            >
              QB
            </span>
            QwikBite
          </Link>
          <nav className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild variant="gradient" size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden py-20 sm:py-28"
          style={{ background: "var(--gradient-brand)" }}
        >
          {/* Decorative blurred circles */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-16 size-64 rounded-full opacity-15 blur-2xl"
            style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }}
          />

          <div className="relative mx-auto max-w-3xl px-6 text-center">
            {/* Emoji lockup */}
            <div
              className="mx-auto mb-6 flex size-20 items-center justify-center rounded-3xl text-5xl shadow-lg"
              style={{ background: "rgba(255,255,255,0.2)", boxShadow: "0 12px 30px rgba(0,0,0,0.15)" }}
              aria-hidden="true"
            >
              🍔
            </div>

            <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Great food, delivered to your door
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-lg text-white/90">
              Discover local restaurants, order your favourites, and track every step — all in one place.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-[var(--brand-dark)] hover:bg-white/90 shadow-lg font-semibold rounded-full"
              >
                <Link href="/browse">Browse restaurants</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="border-2 border-white/70 bg-transparent text-white hover:bg-white/10 rounded-full"
              >
                <Link href="/signin">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Feature tiles ───────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-2 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Why QwikBite?
          </h2>
          <p className="mb-10 text-center text-sm text-muted-foreground">
            A marketplace built for speed, trust, and simplicity.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            {/* Tile 1 */}
            <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
              <span
                className="flex size-12 items-center justify-center rounded-xl"
                style={{ background: "var(--brand-soft)" }}
              >
                <Zap className="size-6 text-[var(--brand-dark)]" aria-hidden="true" />
              </span>
              <div>
                <h3 className="mb-1 font-semibold text-foreground">Lightning-fast ordering</h3>
                <p className="text-sm text-muted-foreground">
                  Add items, confirm your address, and pay in under a minute. Stripe-secured checkout, no account gymnastics required.
                </p>
              </div>
            </div>

            {/* Tile 2 */}
            <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
              <span
                className="flex size-12 items-center justify-center rounded-xl"
                style={{ background: "#e6f8f1" }}
              >
                <Clock className="size-6" style={{ color: "var(--success)" }} aria-hidden="true" />
              </span>
              <div>
                <h3 className="mb-1 font-semibold text-foreground">Live order tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Follow your order from kitchen to door — placed, prepared, picked up, and delivered — with a real-time status timeline.
                </p>
              </div>
            </div>

            {/* Tile 3 */}
            <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6 shadow-[var(--shadow-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
              <span
                className="flex size-12 items-center justify-center rounded-xl"
                style={{ background: "#eaf2fe" }}
              >
                <Shield className="size-6" style={{ color: "var(--info)" }} aria-hidden="true" />
              </span>
              <div>
                <h3 className="mb-1 font-semibold text-foreground">Verified partners only</h3>
                <p className="text-sm text-muted-foreground">
                  Every restaurant and driver is admin-approved before going live. Your food comes from trusted, vetted partners — every time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA band ────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div
            className="flex flex-col items-center gap-6 rounded-2xl px-8 py-12 text-center sm:flex-row sm:justify-between sm:text-left"
            style={{ background: "var(--brand-soft)" }}
          >
            <div>
              <h2 className="mb-1 text-xl font-bold tracking-tight text-foreground">
                Ready to order?
              </h2>
              <p className="text-sm text-muted-foreground">
                Create a free account in seconds. Restaurants and drivers can apply too.
              </p>
            </div>
            <Button asChild variant="gradient" size="lg" className="shrink-0">
              <Link href="/signup">Create a free account</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
            <span
              className="grid size-6 place-items-center rounded-lg text-xs font-bold text-white"
              style={{ background: "var(--gradient-brand)" }}
              aria-hidden="true"
            >
              QB
            </span>
            QwikBite
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} QwikBite. Lightweight in-house delivery — no GPS, no surge.
          </p>
          <nav className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/browse" className="hover:text-foreground transition-colors">
              Browse
            </Link>
            <Link href="/signin" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">
              Sign up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
