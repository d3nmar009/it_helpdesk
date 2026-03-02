"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NotificationItem = {
  id: string;
  message: string;
  createdAt: string;
  ticket: { id: string; ticketNo: string };
};

function formatTime(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function fallbackBeep() {
  // Fallback sound (no asset) in case the mp3 can't be played/loaded.
  try {
    const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const AudioCtx = (window.AudioContext || w.webkitAudioContext) as typeof AudioContext | undefined;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    g.gain.value = 0.0; // we'll ramp for a nicer "notification" sound
    o.connect(g);
    g.connect(ctx.destination);
    o.start();

    // ~3s "notification" pattern: 3 short tones with small gaps + a soft tail.
    const now = ctx.currentTime;
    const tone = (start: number, dur: number, freq: number) => {
      o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0, start);
      g.gain.linearRampToValueAtTime(0.05, start + 0.02);
      g.gain.setValueAtTime(0.05, start + Math.max(dur - 0.06, 0.02));
      g.gain.linearRampToValueAtTime(0.0, start + dur);
    };

    tone(now + 0.00, 0.55, 880);
    tone(now + 0.75, 0.55, 740);
    tone(now + 1.50, 0.55, 880);
    // soft tail
    tone(now + 2.25, 0.70, 660);

    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => null);
    }, 3000);
  } catch {
    // ignore
  }
}

export function NotificationBell({ userId }: { userId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const prevCountRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = items.length;

  const pollMs = 8000;

  const playMp3 = useCallback(async (src: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.preload = "auto";
      audioRef.current.volume = 0.9;
    } else {
      audioRef.current.pause();
      audioRef.current.src = src;
      audioRef.current.load();
    }

    audioRef.current.currentTime = 0;

    // Wait until the file finishes playing (or timeout as a safety net).
    await new Promise<void>((resolve, reject) => {
      const a = audioRef.current;
      if (!a) return resolve();

      const cleanup = () => {
        a.removeEventListener("ended", onEnded);
        a.removeEventListener("error", onError);
      };
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("audio error"));
      };

      a.addEventListener("ended", onEnded, { once: true });
      a.addEventListener("error", onError, { once: true });

      const t = window.setTimeout(() => {
        cleanup();
        resolve();
      }, 8000);

      // ensure timeout is cleared when resolved/rejected
      const wrapResolve = () => {
        window.clearTimeout(t);
        resolve();
      };
      const wrapReject = (err: Error) => {
        window.clearTimeout(t);
        reject(err);
      };

      // swap handlers to clear timeout
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
      a.addEventListener("ended", () => {
        cleanup();
        wrapResolve();
      }, { once: true });
      a.addEventListener("error", () => {
        cleanup();
        wrapReject(new Error("audio error"));
      }, { once: true });

      a.play().catch((err) => {
        cleanup();
        window.clearTimeout(t);
        reject(err instanceof Error ? err : new Error("play failed"));
      });
    });
  }, []);

  const playSound = useCallback(async () => {
    // MP3 files in public/sounds:
    // - public/sounds/Notification1.mp3 -> /sounds/Notification1.mp3
    // - public/sounds/Notification2.mp3 -> /sounds/Notification2.mp3
    const n1 = "/sounds/Notification1.mp3";
    const n2 = "/sounds/Notification2.mp3";
    try {
      // Requirement: when a notification is added, play Notification1 then Notification2.
      await playMp3(n1);
      await playMp3(n2);
    } catch {
      fallbackBeep();
    }
  }, [playMp3]);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications?unread=1&take=20", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as NotificationItem[];
    setItems(data);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    const tick = async () => {
      if (!alive) return;
      await load();
    };

    tick();
    const t = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [userId, load]);

  // play sound when new notifications arrive (after first load)
  useEffect(() => {
    if (prevCountRef.current === null) {
      prevCountRef.current = unreadCount;
      return;
    }
    if (unreadCount > prevCountRef.current) {
      void playSound();
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, playSound]);

  const title = useMemo(() => (unreadCount ? `${unreadCount} unread` : "No new notifications"), [unreadCount]);

  async function markReadAndGo(n: NotificationItem) {
    startTransition(async () => {
      try {
        await fetch(`/api/notifications/${n.id}/read`, { method: "PUT" });
      } finally {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        setOpen(false);
        router.push(`/tickets/${n.ticket.id}`);
      }
    });
  }

  async function clearAll() {
    startTransition(async () => {
      const prev = items;
      setItems([]);
      try {
        const res = await fetch("/api/notifications/clear", { method: "PUT" });
        if (!res.ok) {
          setItems(prev);
          return;
        }
        prevCountRef.current = 0;
      } catch {
        setItems(prev);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative" title={title} disabled={isPending}>
          <Bell className="h-5 w-5" />
          {unreadCount ? (
            <span className="absolute -right-1 -top-1">
              <Badge className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">{unreadCount}</Badge>
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
            </div>
            <div className="flex items-center gap-1">
              {items.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void clearAll();
                  }}
                  disabled={isPending}
                >
                  Clear all
                </Button>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void playSound();
                }}
                disabled={isPending}
              >
                Test sound
              </Button>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-sm text-slate-600 dark:text-slate-300">You’re all caught up.</p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markReadAndGo(n)}
                className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/40"
                disabled={isPending}
              >
                <p className="text-sm font-medium text-slate-900 dark:text-white">{n.message}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{n.ticket.ticketNo}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatTime(n.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}


