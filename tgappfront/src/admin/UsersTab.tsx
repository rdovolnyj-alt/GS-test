import { useState } from "react";
import { HelpCircle, Star, Activity } from "lucide-react";
import { QuestionsTab } from "./QuestionsTab";
import { ReviewsTab } from "./ReviewsTab";
import { ActivityTab } from "./ActivityTab";
import { ScrollToTopButton } from "../components/ScrollToTopButton";

type UsersSubTab = "questions" | "reviews" | "activity";

const subTabs: { key: UsersSubTab; label: string; icon: React.ReactNode }[] = [
  { key: "questions", label: "Вопросы", icon: <HelpCircle size={14} /> },
  { key: "reviews", label: "Отзывы", icon: <Star size={14} /> },
  { key: "activity", label: "Активность", icon: <Activity size={14} /> },
];

type Props = {
  supportUnread: number;
  onSupportUnreadChange: (n: number) => void;
};

export function UsersTab({ supportUnread, onSupportUnreadChange }: Props) {
  const [active, setActive] = useState<UsersSubTab>("questions");

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
            <span
              className={`inline-flex transition-all duration-300 ${
                active === tab.key ? "mr-1.5" : ""
              }`}
            >
              {tab.icon}
            </span>
            <span
              className="overflow-hidden whitespace-nowrap transition-all duration-300"
              style={{
                maxWidth: active === tab.key ? "90px" : "0px",
                opacity: active === tab.key ? 1 : 0,
                transform: `translateX(${active === tab.key ? "0px" : "-6px"})`,
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {active === "questions" && (
        <QuestionsTab supportUnread={supportUnread} onSupportUnreadChange={onSupportUnreadChange} />
      )}
      {active === "reviews" && <ReviewsTab />}
      {active === "activity" && <ActivityTab />}

      <ScrollToTopButton />
    </div>
  );
}
