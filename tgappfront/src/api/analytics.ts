import { api } from "./client";

export type ActivityData = {
  visitors_by_day: { date: string; visitors: number; visits: number; pageviews: number }[];
  sources: { source: string; visits: number; visitors: number }[];
  devices: { device: string; visits: number; visitors: number }[];
  summary: {
    total_visitors: number;
    total_visits: number;
    total_pageviews: number;
    avg_duration: number;
    bounce_rate: number;
  };
};

export async function fetchActivity(days: number = 7): Promise<ActivityData> {
  return api.get<ActivityData>(`/api/admin/activity?days=${days}`);
}
