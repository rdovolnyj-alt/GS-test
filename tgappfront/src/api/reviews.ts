import { api } from "./client";

export type ReviewStatus = "new" | "published" | "hidden";

export type Review = {
  id: number;
  user_id: number | null;
  user_name: string;
  rating: number;
  text: string;
  images: string[];
  status: ReviewStatus;
  created_at: string | null;
};

export type ReviewsData = {
  total: number;
  avg_rating: number;
  reviews: Review[];
};

export async function fetchReviews(): Promise<ReviewsData> {
  return api.get<ReviewsData>("/api/reviews");
}

export async function createReview(data: {
  rating: number;
  text: string;
  images: string[];
}): Promise<Review> {
  return api.post<Review>("/api/reviews", data);
}

export async function fetchAdminReviews(): Promise<Review[]> {
  return api.get<Review[]>("/api/admin/reviews");
}

export async function updateReviewStatus(
  id: number,
  status: ReviewStatus,
): Promise<Review> {
  return api.patch<Review>(`/api/admin/reviews/${id}`, { status });
}

export async function deleteReview(id: number): Promise<void> {
  return api.delete<void>(`/api/admin/reviews/${id}`);
}

export async function deleteAllReviews(
  status?: ReviewStatus,
): Promise<{ ok: boolean; deleted: number }> {
  const qs = status ? `?status=${status}` : "";
  return api.delete<{ ok: boolean; deleted: number }>(`/api/admin/reviews${qs}`);
}
