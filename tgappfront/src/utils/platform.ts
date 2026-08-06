export type Platform = "telegram" | "vk" | "web";

interface TelegramGlobal {
  Telegram?: { WebApp?: { initData?: string } };
  TelegramWebviewProxy?: unknown;
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "web";

  const tg = window as typeof window & TelegramGlobal;
  if (tg.Telegram?.WebApp || tg.TelegramWebviewProxy) {
    return "telegram";
  }

  const params = new URLSearchParams(window.location.search);
  if (
    params.has("vk_app_id") ||
    params.has("vk_platform") ||
    window.location.hash.includes("vk_app_id")
  ) {
    return "vk";
  }

  return "web";
}

export function getTelegramInitData(): string | null {
  try {
    const tg = window as typeof window & TelegramGlobal;
    const webapp = tg.Telegram?.WebApp;
    return webapp?.initData || null;
  } catch {
    return null;
  }
}

export function isMobileKeyboard(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function getVKParams(): { access_token?: string; user_id?: number } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
    const access_token = params.get("access_token") || hashParams.get("access_token") || undefined;
    const user_id_str = params.get("user_id") || hashParams.get("user_id") || undefined;
    if (access_token && user_id_str) {
      return { access_token, user_id: parseInt(user_id_str, 10) };
    }
    return null;
  } catch {
    return null;
  }
}
