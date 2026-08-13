"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const AVATAR_STORAGE_KEY = "ai-tutor-avatar";
const LEARNER_AVATAR_STORAGE_KEY = "ai-learner-avatar";
const BG_STORAGE_KEY = "ai-tutor-bg";
const BG_CUSTOM_STORAGE_KEY = "ai-tutor-bg-custom";
export const KEYWORD_HIGHLIGHT_STORAGE_KEY = "ai-tutor-keyword-highlight";
const KEYWORD_HIGHLIGHT_EVENT = "ai-tutor-keyword-highlight-change";

export const TUTOR_AVATARS = [
  { id: "bot", emoji: "🤖", label: "机器人", ring: "from-sky-400/40 to-blue-500/20" },
  { id: "owl", emoji: "🦉", label: "猫头鹰", ring: "from-amber-400/40 to-orange-500/20" },
  { id: "fox", emoji: "🦊", label: "狐狸", ring: "from-orange-400/40 to-rose-500/20" },
  { id: "cat", emoji: "🐱", label: "猫咪", ring: "from-pink-400/40 to-fuchsia-500/20" },
  { id: "spark", emoji: "✨", label: "星光", ring: "from-cyan-400/40 to-teal-500/20" },
  { id: "sage", emoji: "🧙", label: "导师", ring: "from-violet-400/40 to-indigo-500/20" },
] as const;

export type TutorAvatarId = (typeof TUTOR_AVATARS)[number]["id"];

export const LEARNER_AVATARS = [
  { id: "smile", emoji: "😊", label: "微笑", ring: "from-sky-400/45 to-indigo-500/25" },
  { id: "think", emoji: "🤔", label: "思考", ring: "from-amber-400/45 to-orange-500/25" },
  { id: "nerd", emoji: "🤓", label: "专注", ring: "from-cyan-400/45 to-blue-500/25" },
  { id: "cool", emoji: "😎", label: "自信", ring: "from-violet-400/45 to-fuchsia-500/25" },
  { id: "rocket", emoji: "🚀", label: "冲刺", ring: "from-rose-400/45 to-orange-500/25" },
  { id: "seed", emoji: "🌱", label: "成长", ring: "from-emerald-400/45 to-teal-500/25" },
] as const;

export type LearnerAvatarId = (typeof LEARNER_AVATARS)[number]["id"];

type AvatarOption = { id: string; emoji: string; label: string; ring: string };

export const TEACH_BACKGROUNDS = [
  { id: "aurora", label: "极光", swatch: "linear-gradient(135deg,#1a2744,#163a3a,#2a1f4a)" },
  { id: "dusk", label: "暮色", swatch: "linear-gradient(135deg,#2a1a28,#3a2038,#1c2438)" },
  { id: "ink", label: "墨海", swatch: "linear-gradient(135deg,#12151c,#1a2230,#0f141c)" },
  { id: "mint", label: "薄荷", swatch: "linear-gradient(135deg,#142428,#1a3530,#163040)" },
  { id: "custom", label: "自定义", swatch: "linear-gradient(135deg,#333,#111)" },
] as const;

export type TeachBackgroundId = (typeof TEACH_BACKGROUNDS)[number]["id"];

export function getTutorAvatar(id: string | null | undefined) {
  return TUTOR_AVATARS.find((a) => a.id === id) || TUTOR_AVATARS[0];
}

export function getLearnerAvatar(id: string | null | undefined) {
  return LEARNER_AVATARS.find((a) => a.id === id) || LEARNER_AVATARS[0];
}

function useStoredAvatar<T extends string>(
  storageKey: string,
  options: readonly AvatarOption[],
  fallback: T
) {
  const [avatarId, setAvatarId] = useState<T>(fallback);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) as T | null;
      if (saved && options.some((a) => a.id === saved)) {
        setAvatarId(saved);
      }
    } catch {
      // ignore
    }
  }, [options, storageKey]);

  function selectAvatar(id: T) {
    setAvatarId(id);
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      // ignore
    }
  }

  return { avatarId, selectAvatar };
}

export function useTutorAvatar() {
  const { avatarId, selectAvatar } = useStoredAvatar<TutorAvatarId>(
    AVATAR_STORAGE_KEY,
    TUTOR_AVATARS,
    "bot"
  );
  return { avatar: getTutorAvatar(avatarId), avatarId, selectAvatar };
}

export function useLearnerAvatar() {
  const { avatarId, selectAvatar } = useStoredAvatar<LearnerAvatarId>(
    LEARNER_AVATAR_STORAGE_KEY,
    LEARNER_AVATARS,
    "smile"
  );
  return { avatar: getLearnerAvatar(avatarId), avatarId, selectAvatar };
}

export function useTeachBackground() {
  const [bgId, setBgId] = useState<TeachBackgroundId>("aurora");
  const [customUrl, setCustomUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BG_STORAGE_KEY) as TeachBackgroundId | null;
      if (saved && TEACH_BACKGROUNDS.some((b) => b.id === saved)) {
        setBgId(saved);
      }
      const custom = localStorage.getItem(BG_CUSTOM_STORAGE_KEY);
      if (custom) setCustomUrl(custom);
    } catch {
      // ignore
    }
  }, []);

  function selectBackground(id: TeachBackgroundId) {
    setBgId(id);
    try {
      localStorage.setItem(BG_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  async function setCustomBackground(file: File) {
    const dataUrl = await compressImageFile(file, 1400, 0.72);
    setCustomUrl(dataUrl);
    setBgId("custom");
    try {
      localStorage.setItem(BG_CUSTOM_STORAGE_KEY, dataUrl);
      localStorage.setItem(BG_STORAGE_KEY, "custom");
    } catch {
      throw new Error("图片过大，本地存储失败，请换一张更小的图");
    }
  }

  function clearCustomBackground() {
    setCustomUrl(null);
    try {
      localStorage.removeItem(BG_CUSTOM_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (bgId === "custom") selectBackground("aurora");
  }

  return { bgId, customUrl, selectBackground, setCustomBackground, clearCustomBackground };
}

export function readKeywordHighlightEnabled(): boolean {
  try {
    return localStorage.getItem(KEYWORD_HIGHLIGHT_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function useKeywordHighlight() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(readKeywordHighlightEnabled());
    function sync() {
      setEnabled(readKeywordHighlightEnabled());
    }
    window.addEventListener("storage", sync);
    window.addEventListener(KEYWORD_HIGHLIGHT_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(KEYWORD_HIGHLIGHT_EVENT, sync);
    };
  }, []);

  function setKeywordHighlight(next: boolean) {
    setEnabled(next);
    try {
      localStorage.setItem(KEYWORD_HIGHLIGHT_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(KEYWORD_HIGHLIGHT_EVENT));
  }

  return { keywordHighlight: enabled, setKeywordHighlight };
}

function compressImageFile(file: File, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("图片格式不支持"));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法处理图片"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Render AI text with **重点词** and `code` emphasis. */
export function HighlightedText({
  text,
  highlight = true,
}: {
  text: string;
  highlight?: boolean;
}) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, lineIdx) => (
        <p key={lineIdx} className={lineIdx > 0 ? "mt-2.5" : undefined}>
          {line.trim() === "" ? "\u00A0" : renderInline(line, highlight)}
        </p>
      ))}
    </>
  );
}

function renderInline(line: string, highlight: boolean): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      nodes.push(<span key={`t-${key++}`}>{line.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith("**")) {
      const inner = token.slice(2, -2);
      nodes.push(
        highlight ? (
          <mark key={`h-${key++}`} className="keyword-mark">
            {inner}
          </mark>
        ) : (
          <strong key={`h-${key++}`} className="font-semibold text-foreground">
            {inner}
          </strong>
        )
      );
    } else {
      const inner = token.slice(1, -1);
      nodes.push(
        <code key={`c-${key++}`} className={highlight ? "keyword-code" : "keyword-code-plain"}>
          {inner}
        </code>
      );
    }
    last = match.index + token.length;
  }

  if (last < line.length) {
    nodes.push(<span key={`t-${key++}`}>{line.slice(last)}</span>);
  }
  return nodes;
}

export function TutorAvatarBadge({
  avatarId,
  size = "md",
}: {
  avatarId: TutorAvatarId;
  size?: "sm" | "md";
}) {
  const avatar = getTutorAvatar(avatarId);
  const dim = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br ${avatar.ring} border border-white/10 shadow-inner`}
    >
      <span>{avatar.emoji}</span>
    </div>
  );
}

/** Click the message avatar itself to replace image (horizontal scroll strip). */
function EmojiAvatarPicker({
  avatarId,
  options,
  onSelect,
  size = "sm",
  side = "left",
  title = "点击更换形象",
}: {
  avatarId: string;
  options: readonly AvatarOption[];
  onSelect: (id: string) => void;
  size?: "sm" | "md";
  side?: "left" | "right";
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((a) => a.id === avatarId) || options[0];
  const dim = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const strip = open && (
    <div className="flex-1 min-w-0 overflow-x-auto overscroll-x-contain rounded-full border border-border/35 bg-card/90 backdrop-blur-md px-1.5 py-1 shadow-lg [scrollbar-width:thin]">
      <div className="flex items-center gap-1 w-max">
        {options.map((a) => {
          const active = a.id === avatarId;
          return (
            <button
              key={a.id}
              type="button"
              title={a.label}
              onClick={() => {
                onSelect(a.id);
                setOpen(false);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 transition-all bg-gradient-to-br ${a.ring} border ${
                active
                  ? "border-primary/55 ring-2 ring-primary/30 scale-105"
                  : "border-white/10 opacity-75 hover:opacity-100"
              }`}
            >
              <span aria-hidden>{a.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      title={title}
      className={`${dim} rounded-full flex items-center justify-center bg-gradient-to-br ${current.ring} border border-white/15 shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:scale-105 hover:border-primary/40 transition-all cursor-pointer shrink-0`}
    >
      <span aria-hidden>{current.emoji}</span>
    </button>
  );

  return (
    <div
      className={`flex items-end gap-1.5 shrink-0 self-end max-w-[min(260px,46vw)] ${
        side === "right" ? "flex-row-reverse" : ""
      }`}
      ref={rootRef}
    >
      {trigger}
      {strip}
    </div>
  );
}

export function TutorAvatarPicker({
  avatarId,
  onSelect,
  size = "sm",
}: {
  avatarId: TutorAvatarId;
  onSelect: (id: TutorAvatarId) => void;
  size?: "sm" | "md";
}) {
  return (
    <EmojiAvatarPicker
      avatarId={avatarId}
      options={TUTOR_AVATARS}
      onSelect={(id) => onSelect(id as TutorAvatarId)}
      size={size}
      side="left"
      title="点击更换导师形象"
    />
  );
}

export function LearnerAvatarPicker({
  avatarId,
  onSelect,
  size = "sm",
}: {
  avatarId: LearnerAvatarId;
  onSelect: (id: LearnerAvatarId) => void;
  size?: "sm" | "md";
}) {
  return (
    <EmojiAvatarPicker
      avatarId={avatarId}
      options={LEARNER_AVATARS}
      onSelect={(id) => onSelect(id as LearnerAvatarId)}
      size={size}
      side="right"
      title="点击更换我的形象"
    />
  );
}

export function TeachBackgroundPicker({
  bgId,
  customUrl,
  onSelect,
  onUpload,
  onClearCustom,
}: {
  bgId: TeachBackgroundId;
  customUrl: string | null;
  onSelect: (id: TeachBackgroundId) => void;
  onUpload: (file: File) => Promise<void>;
  onClearCustom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = TEACH_BACKGROUNDS.find((b) => b.id === bgId) || TEACH_BACKGROUNDS[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative z-[60]" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-border/30 bg-card/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/35 transition-all"
        title="更换背景"
      >
        背景 · {current.label}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[280px] rounded-xl border border-border/40 bg-card/98 backdrop-blur-xl p-3 shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] text-muted-foreground mb-2">选择背景主题，或上传自己的图片</p>
          <div className="grid grid-cols-2 gap-2">
            {TEACH_BACKGROUNDS.filter((b) => b.id !== "custom").map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onSelect(b.id);
                  setOpen(false);
                }}
                className={`rounded-lg overflow-hidden border text-left transition-all ${
                  bgId === b.id ? "border-primary/50 ring-1 ring-primary/30" : "border-border/30 hover:border-border/60"
                }`}
              >
                <div className="h-14 w-full" style={{ background: b.swatch }} />
                <div className="px-2 py-1.5 text-[11px] flex items-center justify-between gap-1">
                  <span>{b.label}</span>
                  {bgId === b.id && <span className="text-primary text-[10px]">使用中</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-border/40 px-3 py-2 text-xs hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
            >
              {busy ? "处理中..." : customUrl ? "重新上传自定义背景" : "上传自定义背景图"}
            </button>
            {customUrl && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelect("custom");
                    setOpen(false);
                  }}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] border ${
                    bgId === "custom" ? "border-primary/40 bg-primary/10" : "border-border/30"
                  }`}
                >
                  使用自定义图
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearCustom();
                    setErr("");
                  }}
                  className="rounded-lg px-2 py-1.5 text-[11px] text-destructive/80 border border-border/30"
                >
                  清除
                </button>
              </div>
            )}
            {err && <p className="text-[11px] text-destructive">{err}</p>}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setErr("");
              try {
                await onUpload(file);
                setOpen(false);
              } catch (error) {
                setErr((error as Error).message || "上传失败");
              } finally {
                setBusy(false);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

const THEME_VISUALS: Record<
  Exclude<TeachBackgroundId, "custom">,
  { base: string; blob1: string; blob2: string; blob3: string }
> = {
  aurora: {
    base: "linear-gradient(160deg, #0b1a3a 0%, #0d2f3a 45%, #1a1540 100%)",
    blob1: "radial-gradient(circle, rgba(99,140,255,0.45), transparent 70%)",
    blob2: "radial-gradient(circle, rgba(52,211,192,0.35), transparent 70%)",
    blob3: "radial-gradient(circle, rgba(167,139,250,0.28), transparent 70%)",
  },
  dusk: {
    base: "linear-gradient(160deg, #2a1020 0%, #3a1830 40%, #1a1438 100%)",
    blob1: "radial-gradient(circle, rgba(244,114,182,0.42), transparent 70%)",
    blob2: "radial-gradient(circle, rgba(251,113,133,0.32), transparent 70%)",
    blob3: "radial-gradient(circle, rgba(99,102,241,0.28), transparent 70%)",
  },
  ink: {
    base: "linear-gradient(160deg, #0a0c10 0%, #141820 50%, #0d1118 100%)",
    blob1: "radial-gradient(circle, rgba(148,163,184,0.22), transparent 70%)",
    blob2: "radial-gradient(circle, rgba(100,116,139,0.18), transparent 70%)",
    blob3: "radial-gradient(circle, rgba(203,213,225,0.12), transparent 70%)",
  },
  mint: {
    base: "linear-gradient(160deg, #06241e 0%, #0d2f28 45%, #0a2438 100%)",
    blob1: "radial-gradient(circle, rgba(45,212,191,0.42), transparent 70%)",
    blob2: "radial-gradient(circle, rgba(52,211,153,0.3), transparent 70%)",
    blob3: "radial-gradient(circle, rgba(96,165,250,0.28), transparent 70%)",
  },
};

export function TeachChatBackdrop({
  bgId,
  customUrl,
}: {
  bgId: TeachBackgroundId;
  customUrl: string | null;
}) {
  const useCustom = bgId === "custom" && !!customUrl;
  const theme = THEME_VISUALS[bgId === "custom" ? "aurora" : bgId] || THEME_VISUALS.aurora;

  return (
    <div className="teach-chat-backdrop pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        key={useCustom ? "custom" : bgId}
        className="absolute inset-0 transition-[background] duration-500"
        style={
          useCustom
            ? {
                backgroundImage: `linear-gradient(160deg, rgba(8,12,24,0.55) 0%, rgba(10,16,28,0.4) 100%), url(${customUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { backgroundImage: theme.base }
        }
      />
      {!useCustom && (
        <>
          <div
            className="absolute -top-24 -right-16 w-[460px] h-[460px] rounded-full blur-2xl animate-[teachFloat_12s_ease-in-out_infinite] transition-opacity duration-500"
            style={{ backgroundImage: theme.blob1 }}
          />
          <div
            className="absolute bottom-0 -left-20 w-[400px] h-[400px] rounded-full blur-2xl animate-[teachFloat_16s_ease-in-out_infinite_reverse] transition-opacity duration-500"
            style={{ backgroundImage: theme.blob2 }}
          />
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-3xl transition-opacity duration-500"
            style={{ backgroundImage: theme.blob3 }}
          />
        </>
      )}
      <div className="absolute inset-0 teach-chat-grid opacity-[0.28]" />
    </div>
  );
}
