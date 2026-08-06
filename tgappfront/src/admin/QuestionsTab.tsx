import { useState } from "react";
import { HelpCircle, MessageCircle } from "lucide-react";
import { FaqTab } from "./FaqTab";
import { SupportChatTab } from "./SupportChatTab";

type QuestionsSubTab = "faq" | "support";

const subTabs: { key: QuestionsSubTab; label: string; icon: React.ReactNode }[] = [
  { key: "support", label: "Чат-поддержка", icon: <MessageCircle size={14} /> },
  { key: "faq", label: "FAQ", icon: <HelpCircle size={14} /> },
];

type Props = {
  supportUnread: number;
  onSupportUnreadChange: (n: number) => void;
};

export function QuestionsTab({ supportUnread, onSupportUnreadChange }: Props) {
  const [active, setActive] = useState<QuestionsSubTab>("support");

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`relative flex h-9 items-center rounded-xl border px-2.5 text-xs font-medium transition active:scale-95 ${
              active === tab.key
                ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"
            }`}
          >
            <span className={`inline-flex transition-all duration-300 ${active === tab.key ? "mr-1.5" : ""}`}>
              {tab.icon}
            </span>
            <span
              className="overflow-hidden whitespace-nowrap transition-all duration-300"
              style={{
                maxWidth: active === tab.key ? "140px" : "0px",
                opacity: active === tab.key ? 1 : 0,
                transform: `translateX(${active === tab.key ? "0px" : "-6px"})`,
              }}
            >
              {tab.label}
            </span>
            {tab.key === "support" && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  supportUnread > 0 ? "bg-[#fbbf24] font-bold text-black" : "bg-[var(--c-text-40)]/20"
                }`}
              >
                {supportUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      {active === "faq" && <FaqTab />}
      {active === "support" && (
        <SupportChatTab onCountChange={onSupportUnreadChange} />
      )}
    </div>
  );
}
