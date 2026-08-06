import { api } from "./client";

export type Faq = {
  id: number;
  question: string;
  answer: string;
  position: number;
  created_at: string | null;
};

export type SupportMessage = {
  id: number;
  conversation_id: number;
  sender: "user" | "admin";
  text: string;
  images: string[];
  created_at: string | null;
};

export type SupportConversation = {
  id: number;
  user_id: number | null;
  user_name: string;
  status: "open" | "closed";
  unread: boolean;
  admin_unread_count: number;
  created_at: string | null;
  updated_at: string | null;
  last_message: string | null;
  last_message_at: string | null;
  messages?: SupportMessage[];
};

export async function fetchFaq(): Promise<Faq[]> {
  return api.get<Faq[]>("/api/faq");
}

export async function createFaq(data: { question: string; answer: string }): Promise<Faq> {
  return api.post<Faq>("/api/admin/faq", data);
}

export async function updateFaq(id: number, data: { question: string; answer: string }): Promise<Faq> {
  return api.patch<Faq>(`/api/admin/faq/${id}`, data);
}

export async function deleteFaq(id: number): Promise<void> {
  return api.delete<void>(`/api/admin/faq/${id}`);
}

export async function deleteAllFaq(): Promise<{ ok: boolean; deleted: number }> {
  return api.delete<{ ok: boolean; deleted: number }>("/api/admin/faq");
}

export async function reorderFaq(ids: number[]): Promise<{ ok: boolean }> {
  return api.put<{ ok: boolean }>("/api/admin/faq/reorder", { ids });
}

export async function createSupportConversation(
  text: string,
  images?: string[],
): Promise<SupportConversation> {
  return api.post<SupportConversation>("/api/support/conversations", { text, images: images ?? [] });
}

export async function fetchMyConversations(): Promise<SupportConversation[]> {
  return api.get<SupportConversation[]>("/api/support/conversations");
}

export async function sendSupportMessage(
  convId: number,
  text: string,
  images?: string[],
): Promise<SupportMessage> {
  return api.post<SupportMessage>(`/api/support/conversations/${convId}/messages`, {
    text,
    images: images ?? [],
  });
}

export async function markSupportConversationRead(convId: number): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/api/support/conversations/${convId}/read`, {});
}

export async function fetchSupportUnread(): Promise<{ unread: boolean }> {
  return api.get<{ unread: boolean }>("/api/support/unread");
}

export async function fetchAdminConversations(): Promise<SupportConversation[]> {
  return api.get<SupportConversation[]>("/api/admin/support/conversations");
}

export async function fetchAdminConversation(convId: number): Promise<SupportConversation> {
  return api.get<SupportConversation>(`/api/admin/support/conversations/${convId}`);
}

export async function sendAdminSupportMessage(
  convId: number,
  text: string,
  images?: string[],
): Promise<SupportMessage> {
  return api.post<SupportMessage>(`/api/admin/support/conversations/${convId}/messages`, {
    text,
    images: images ?? [],
  });
}

export async function deleteAdminSupportConversation(convId: number): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>(`/api/admin/support/conversations/${convId}`);
}
