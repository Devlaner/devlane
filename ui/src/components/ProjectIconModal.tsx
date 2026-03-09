import { useState, useMemo, useEffect } from "react";
import { Modal } from "./ui";

const EMOJI_LIST = [
  "🏠",
  "🚀",
  "📁",
  "💡",
  "🔧",
  "⭐",
  "🎯",
  "📌",
  "🏷️",
  "📋",
  "✅",
  "🐛",
  "🔒",
  "📱",
  "💻",
  "🌟",
  "🎨",
  "📊",
  "📈",
  "🔥",
  "❤️",
  "🎉",
  "📦",
  "🔔",
  "⚙️",
  "🌈",
  "🏆",
  "📝",
  "🗂️",
  "🔑",
  "🎪",
  "🧩",
  "📌",
  "🛠️",
  "💼",
  "🌍",
  "🔔",
];

const ICON_COLORS = [
  "#94a3b8",
  "#64748b",
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ec4899",
  "#ffffff",
];

// Simple line icons (name -> path d)
const ICON_PATHS: Record<string, string> = {
  home: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  star: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  folder:
    "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
  briefcase: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  target:
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z",
  bookmark: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  box: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  globe:
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  cog: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  heart:
    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  rocket:
    "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",
  lightbulb:
    "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
  palette:
    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
};

const ICON_NAMES = Object.keys(ICON_PATHS);

function IconSvg({
  name,
  color,
  size = 24,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/** Renders project icon (emoji or icon with color) for display in headers/sidebar. */
export function ProjectIconDisplay({
  emoji,
  icon_prop,
  size = 20,
  className = "",
}: {
  emoji?: string | null;
  icon_prop?: { name?: string; color?: string } | null;
  size?: number;
  className?: string;
}) {
  if (emoji) {
    return (
      <span
        className={className}
        style={{ fontSize: size }}
        role="img"
        aria-hidden
      >
        {emoji}
      </span>
    );
  }
  if (icon_prop?.name && ICON_PATHS[icon_prop.name]) {
    return (
      <span className={className}>
        <IconSvg
          name={icon_prop.name}
          color={icon_prop.color || "currentColor"}
          size={size}
        />
      </span>
    );
  }
  return (
    <span className={className}>
      <IconSvg name="home" color="currentColor" size={size} />
    </span>
  );
}

export interface ProjectIconSelection {
  emoji?: string | null;
  icon_prop?: { name: string; color?: string } | null;
}

export interface ProjectIconModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: ProjectIconSelection) => void;
  title?: string;
  currentEmoji?: string | null;
  currentIconProp?: { name?: string; color?: string } | null;
}

const TAB_EMOJI = "emoji";
const TAB_ICON = "icon";
type Tab = typeof TAB_EMOJI | typeof TAB_ICON;

export function ProjectIconModal({
  open,
  onClose,
  onSelect,
  title = "Project icon",
  currentEmoji,
  currentIconProp,
}: ProjectIconModalProps) {
  void currentEmoji; // reserved for future use (e.g. pre-select emoji tab)
  const [tab, setTab] = useState<Tab>(TAB_EMOJI);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [iconColor, setIconColor] = useState(
    currentIconProp?.color ?? "#6366f1",
  );

  useEffect(() => {
    if (open) {
      // Intentional: sync form state when modal opens (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIconColor(currentIconProp?.color ?? "#6366f1");
      setEmojiSearch("");
    }
  }, [open, currentIconProp?.color]);

  const filteredEmojis = useMemo(() => {
    if (!emojiSearch.trim()) return EMOJI_LIST;
    const q = emojiSearch.toLowerCase();
    return EMOJI_LIST.filter(
      (e) =>
        e.includes(q) ||
        String.fromCodePoint(e.codePointAt(0)!).toLowerCase().includes(q),
    );
  }, [emojiSearch]);

  const handleEmojiSelect = (emoji: string) => {
    onSelect({ emoji, icon_prop: null });
    onClose();
  };

  const handleIconSelect = (name: string) => {
    onSelect({ emoji: null, icon_prop: { name, color: iconColor } });
    onClose();
  };

  const footer = (
    <button
      type="button"
      onClick={onClose}
      className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-3 py-1.5 text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-2-hover)]"
    >
      Cancel
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      className="max-w-md"
    >
      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-3 mb-3">
        <button
          type="button"
          onClick={() => setTab(TAB_EMOJI)}
          className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === TAB_EMOJI
              ? "bg-[var(--brand-default)] text-white"
              : "text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-transparent-hover)]"
          }`}
        >
          Emoji
        </button>
        <button
          type="button"
          onClick={() => setTab(TAB_ICON)}
          className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === TAB_ICON
              ? "bg-[var(--brand-default)] text-white"
              : "text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-transparent-hover)]"
          }`}
        >
          Icon
        </button>
      </div>

      {tab === TAB_EMOJI && (
        <div className="space-y-3">
          <input
            type="text"
            value={emojiSearch}
            onChange={(e) => setEmojiSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none focus:border-[var(--border-strong)]"
          />
          <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto">
            {filteredEmojis.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-xl hover:bg-[var(--bg-layer-transparent-hover)]"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === TAB_ICON && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--txt-tertiary)]">Color</p>
          <div className="flex flex-wrap gap-2">
            {ICON_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setIconColor(c)}
                className="size-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor:
                    iconColor === c ? "var(--brand-default)" : "transparent",
                  boxShadow:
                    c === "#ffffff"
                      ? "0 0 0 1px var(--border-subtle)"
                      : undefined,
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--txt-tertiary)]">Choose an icon</p>
          <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
            {ICON_NAMES.map((name) => (
              <button
                type="button"
                key={name}
                onClick={() => handleIconSelect(name)}
                className="flex size-10 items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--bg-layer-transparent-hover)]"
                title={name}
              >
                <IconSvg name={name} color={iconColor} size={20} />
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
