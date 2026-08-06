import { useEffect, useState } from "react";
import { ShoppingCart, Package, Users, LogOut, Bell } from "lucide-react";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { OrdersTab } from "./OrdersTab";
import { ProductsTab } from "./ProductsTab";
import { UsersTab } from "./UsersTab";
import { fetchAdminConversations } from "../api/support";
import { onWsEvent } from "../api/socket";

type AdminTab = "orders" | "products" | "users";

const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: "orders", label: "Заказы", icon: <ShoppingCart size={18} /> },
  { key: "products", label: "Товары", icon: <Package size={18} /> },
  { key: "users", label: "Пользователи", icon: <Users size={18} /> },
];

type Props = {
  onClose: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
};

function adminUnreadDialogs(convs: { admin_unread_count?: number }[]): number {
  return convs.filter((c) => (c.admin_unread_count ?? 0) > 0).length;
}

export function AdminPage({ onClose, theme, onToggleTheme }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [supportUnread, setSupportUnread] = useState(0);

  const refreshSupportUnread = () => {
    fetchAdminConversations()
      .then((c) => setSupportUnread(adminUnreadDialogs(c)))
      .catch(() => {});
  };

  useEffect(() => {
    refreshSupportUnread();
  }, []);

  useEffect(() => {
    const unsub = onWsEvent("support_user_message", refreshSupportUnread);
    return unsub;
  }, []);

  return (
    <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--c-border)] bg-[var(--c-bg-header)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 py-1 text-xs font-medium text-[var(--c-accent-soft)]">
              Админ-панель
            </span>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
              aria-label="Выйти из админки"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center rounded-2xl border px-5 py-2.5 text-sm font-medium transition active:scale-95 ${
                activeTab === tab.key
                  ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] hover:bg-[var(--c-surface-hover)]"
              }`}
            >
              <span
                className={`inline-flex transition-all duration-300 ${
                  activeTab === tab.key ? "mr-1.5" : ""
                }`}
              >
                {tab.icon}
              </span>
              <span
                className="overflow-hidden whitespace-nowrap transition-all duration-300"
                style={{
                  maxWidth: activeTab === tab.key ? "120px" : "0px",
                  opacity: activeTab === tab.key ? 1 : 0,
                  transform: `translateX(${activeTab === tab.key ? "0px" : "-6px"})`,
                }}
              >
                {tab.label}
              </span>
              {tab.key === "users" && supportUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#fbbf24] text-black shadow-md">
                  <Bell size={10} />
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "products" && <ProductsTab />}
        {activeTab === "orders" && <OrdersTab />}
        {activeTab === "users" && (
          <UsersTab supportUnread={supportUnread} onSupportUnreadChange={setSupportUnread} />
        )}
      </div>
    </div>
  );
}
