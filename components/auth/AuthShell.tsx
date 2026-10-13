import Image from "next/image";
import type { LucideIcon } from "lucide-react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";

export type AuthHighlight = { icon: LucideIcon; title: string; text: string };

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/30">
        <Image src="/favicon.png" alt="QUEZELCO1" width={32} height={32} className="size-8 object-contain" />
      </div>
      <div>
        <p className="text-base font-bold leading-none tracking-tight text-white">IT Helpdesk</p>
        <p className="mt-1.5 text-sm leading-none text-blue-100/80">{subtitle}</p>
      </div>
    </div>
  );
}

export function AuthShell({
  eyebrow,
  heading,
  description,
  highlights,
  children,
}: {
  eyebrow: string;
  heading: string;
  description: string;
  highlights: AuthHighlight[];
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-slate-950">
      <Image
        src="/images/helpdesk-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-left"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-blue-950/60 to-slate-950/85" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.25),transparent_55%)]" />

      <ThemeToggle className="fixed right-5 top-5 z-20 border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white dark:text-white dark:hover:bg-white/20" />

      <div className="relative z-10 grid min-h-svh lg:grid-cols-[1.15fr_1fr]">
        <aside className="hidden flex-col justify-between p-12 text-white lg:flex xl:p-16">
          <Brand subtitle="Workplan & Accomplishment System" />

          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-100 backdrop-blur">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" />
              {eyebrow}
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">{heading}</h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-blue-100/80">{description}</p>

            <div className="mt-10 grid gap-3">
              {highlights.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-900/40">
                    <Icon className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-blue-100/70">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-blue-100/60">
            © {new Date().getFullYear()} QUEZELCO1 • IT Helpdesk • Workplan &amp; Accomplishment
          </p>
        </aside>

        <main className="flex items-center justify-center p-4 py-10 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-6 lg:hidden">
              <Brand subtitle="Workplan & Accomplishment System" />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export const authCardClass =
  "w-full gap-0 rounded-2xl border border-white/20 bg-white/95 py-0 shadow-2xl shadow-black/40 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90";

export const authInputClass =
  "h-11 rounded-xl border-slate-200 bg-slate-50/80 pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white dark:placeholder:text-slate-500";

export const authSubmitClass =
  "h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60";
