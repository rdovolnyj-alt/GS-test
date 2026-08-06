import { useState, useEffect } from "react";
import type { PieLabelRenderProps } from "recharts";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { fetchActivity, type ActivityData } from "../api/analytics";
import { Users, Eye, MousePointerClick, Clock, TrendingUp } from "lucide-react";

const DEVICE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];
const SOURCE_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6"];

interface PieDatum {
  source?: string;
  device?: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}с`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}м ${s}с`;
}

export function ActivityTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchActivity(days)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <p className="text-sm text-[var(--c-text-50)] py-8 text-center">Загрузка активности...</p>;
  }

  if (!data || data.visitors_by_day.length === 0) {
    return (
      <div className="space-y-6">
        <PeriodTabs days={days} onChange={setDays} />
        <p className="text-sm text-[var(--c-text-50)] py-8 text-center">Нет данных. Укажите YANDEX_METRIKA_COUNTER и YANDEX_METRIKA_TOKEN в .env</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PeriodTabs days={days} onChange={setDays} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard icon={<Users size={20} />} label="Посетители" value={String(Math.round(data.summary.total_visitors))} />
        <StatCard icon={<MousePointerClick size={20} />} label="Визиты" value={String(Math.round(data.summary.total_visits))} />
        <StatCard icon={<Eye size={20} />} label="Просмотры" value={String(Math.round(data.summary.total_pageviews))} />
        <StatCard icon={<Clock size={20} />} label="На сайте" value={formatDuration(data.summary.avg_duration)} />
        <StatCard icon={<TrendingUp size={20} />} label="Отказы" value={`${data.summary.bounce_rate.toFixed(1)}%`} />
      </div>

      <ChartCard title="Посетители, визиты и просмотры по дням">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.visitors_by_day}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--c-text-40)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--c-text-40)" }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="visitors" name="Посетители" fill="var(--c-accent)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="visits" name="Визиты" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 sm:grid-cols-2">
        <ChartCard title="Источники трафика">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.sources}
                dataKey="visits"
                nameKey="source"
                cx="50%" cy="50%"
                outerRadius={80}
                label={({ payload, percent }: PieLabelRenderProps) =>
                  `${(payload as PieDatum).source ?? ""} ${(Number(percent) * 100).toFixed(0)}%`
                }
              >
                {data.sources.map((_, i) => (
                  <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Устройства">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.devices}
                dataKey="visits"
                nameKey="device"
                cx="50%" cy="50%"
                outerRadius={80}
                label={({ payload, percent }: PieLabelRenderProps) =>
                  `${(payload as PieDatum).device ?? ""} ${(Number(percent) * 100).toFixed(0)}%`
                }
              >
                {data.devices.map((_, i) => (
                  <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function PeriodTabs({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  const options = [
    { value: 1, label: "24ч" },
    { value: 7, label: "7 дней" },
    { value: 30, label: "30 дней" },
    { value: 90, label: "90 дней" },
  ];
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-xl border px-4 py-1.5 text-xs font-medium transition ${
            days === opt.value
              ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
              : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--c-text-40)] mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-semibold text-[var(--c-text)]">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <h4 className="text-sm font-medium mb-3">{title}</h4>
      <div className="h-64">{children}</div>
    </div>
  );
}
