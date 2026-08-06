 import { useState, useEffect, useRef, useCallback } from "react";
import { ShoppingCart, User, Shield, Star, Bell } from "lucide-react";
import type { Product, CartItem, DeliveryData, ApiProduct } from "./types/product";
import type { Category } from "./data/categories";
import { buildCategories } from "./data/categories";
import { fetchCategories, fetchProducts } from "./api/products";
import { fetchReviews } from "./api/reviews";
import { createOrder, fetchOrders, fetchOrdersUnread, markOrdersRead } from "./api/orders";
import { computeGifts, type Gift } from "./api/promos";
import { Logo } from "./components/Logo";
import { HomePage } from "./pages/HomePage";
import { SubcategoryPage } from "./pages/SubcategoryPage";
import { ProductPage } from "./pages/ProductPage";
import { CartPage } from "./pages/CartPage";
import { ThemeToggle } from "./components/ThemeToggle";
import { CheckoutModal } from "./components/CheckoutModal";
import { AdminPage } from "./admin/AdminPage";
import { CourierPage } from "./pages/CourierPage";
import { hasPendingTradeInConfirm } from "./utils/tradeIn";
import { OrderSuccessPage } from "./pages/OrderSuccessPage";
import { MyOrdersPage } from "./pages/MyOrdersPage";
import { useAuth } from "./context/useAuth";
import { updateProfile, login as apiLogin, register as apiRegister, mergeCart, telegramAuth, vkAuth, googleAuth as apiGoogleAuth, telegramBrowserAuth, vkCodeAuth } from "./api/auth";
import { SetPasswordModal } from "./components/SetPasswordModal";
import { connectWs, disconnectWs, onWsEvent } from "./api/socket";
import { detectPlatform, getTelegramInitData, getVKParams } from "./utils/platform";
import { AuthModal } from "./components/AuthModal";
import { ReviewsPage } from "./pages/ReviewsPage";
import { QuestionsModal } from "./components/QuestionsModal";
import { fetchSupportUnread } from "./api/support";

const THEME_PREF_KEY = "theme_pref";
type ThemePref = "auto" | "dark" | "light";

function getAutoTheme(): "dark" | "light" {
  const h = new Date().getHours();
  return h >= 6 && h < 19 ? "light" : "dark";
}

function loadThemePref(): ThemePref {
  let s: string | null = null;
  try {
    s = localStorage.getItem(THEME_PREF_KEY);
  } catch (e) {
    console.warn("Failed to read theme pref:", e);
  }
  if (s === "dark" || s === "light") return s;
  return "auto";
}

type FlyState = {
  src: string;
  from: DOMRect;
  to: DOMRect | null;
  progress: number;
  done: boolean;
};

function AppContent() {
  const { user, token, loading, setAuth, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"home" | "cart">("home");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Product[] | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const pref = loadThemePref();
    return pref === "auto" ? getAutoTheme() : pref;
  });
  const [themePref, setThemePref] = useState<ThemePref>(loadThemePref);
  const [sbKey, setSbKey] = useState(0);
  const [flyState, setFlyState] = useState<FlyState | null>(null);
  const [cartBump, setCartBump] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showCourier, setShowCourier] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<number | null>(null);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);
  const [hasTradeInNotification, setHasTradeInNotification] = useState(false);
  const [hasSupportNotification, setHasSupportNotification] = useState(false);
  const [hasOrdersNotification, setHasOrdersNotification] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [openReviewFormOnOpen, setOpenReviewFormOnOpen] = useState(false);
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const showCart = activeTab === "cart";

  useEffect(() => {
    (async () => {
      try {
        const apiCategories = await fetchCategories();
        // Грузим ВСЕ товары постранично, иначе при лимите (например 500)
        // часть моделей/подкатегорий выпадает из каталога.
        const limit = 500;
        const apiProducts: ApiProduct[] = [];
        let offset = 0;
        while (true) {
          const { items, total } = await fetchProducts({ offset, limit });
          apiProducts.push(...items);
          offset += items.length;
          if (offset >= total || items.length === 0) break;
        }
        setCategories(buildCategories(apiCategories, apiProducts.filter((p) => p.is_available)));
      } catch (e) {
        console.error("Failed to load categories:", e);
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchReviews()
      .then((d) => setReviewsCount(d.total))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      void Promise.resolve().then(() => setHasSupportNotification(false));
      return;
    }
    fetchSupportUnread()
      .then((r) => setHasSupportNotification(r.unread))
      .catch(() => {});
    const unsub = onWsEvent("support_reply", () => setHasSupportNotification(true));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      void Promise.resolve().then(() => setHasOrdersNotification(false));
      return;
    }
    fetchOrdersUnread()
      .then((r) => setHasOrdersNotification(r.unread))
      .catch(() => {});
    const unsub = onWsEvent("order_status_updated", () => setHasOrdersNotification(true));
    return () => unsub();
  }, [user]);

  // Auto-login via Telegram / VK platform
  useEffect(() => {
    if (user || loading) return;
    const platform = detectPlatform();
    if (platform === "telegram") {
      const initData = getTelegramInitData();
      if (initData) {
        telegramAuth(initData)
          .then((r) => setAuth(r.token, r.user))
          .catch(() => {});
      }
    } else if (platform === "vk") {
      const params = getVKParams();
      if (params && params.access_token && params.user_id) {
        vkAuth({ access_token: params.access_token, user_id: params.user_id })
          .then((r) => setAuth(r.token, r.user))
          .catch(() => {});
      }
    }
  }, [user, loading, setAuth]);

  // Handle OAuth redirect callbacks (Google, VK)
  useEffect(() => {
    if (user) return;

    // Google OAuth callback: URL hash contains id_token
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
    const googleToken = hashParams.get("id_token");
    if (googleToken) {
      apiGoogleAuth(googleToken)
        .then((r) => {
          setAuth(r.token, r.user);
          window.history.replaceState(null, "", window.location.pathname);
        })
        .catch(() => {});
      return;
    }

    // VK OAuth callback: URL query contains code
    const queryParams = new URLSearchParams(window.location.search);
    const vkCode = queryParams.get("code");
    if (vkCode) {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      vkCodeAuth(vkCode, redirectUri)
        .then((r) => {
          setAuth(r.token, r.user);
          window.history.replaceState(null, "", window.location.pathname);
          if (r.user.role === "admin") setShowAdmin(true);
          if (r.user.role === "courier") setShowCourier(true);
        })
        .catch(() => {});
    }
  }, [user, setAuth]);

  // Cart merge: on auth, merge local cart to server
  useEffect(() => {
    if (token && cart.length > 0 && user) {
      mergeCart(cart.map((i) => ({ id: Number(i.id), quantity: i.quantity }))).catch(() => {});
    }
  }, [token, user, cart]);

  // WebSocket: connect on auth, disconnect on logout
  useEffect(() => {
    if (token) {
      connectWs(token);
    } else {
      disconnectWs();
    }
  }, [token]);

  useEffect(() => {
    if (!user) return;
    fetchOrders({ limit: 100 }).then((data) => {
      const completed = data.items.filter((o) => o.status === "completed");
      const seenKey = `seen_completed_orders_${user.id}`;
      const seenRaw = localStorage.getItem(seenKey);
      const seen: number[] = seenRaw ? JSON.parse(seenRaw) : [];
      const hasNew = completed.some((o) => !seen.includes(o.id));
      if (hasNew) setHasNotification(true);
    }).catch(() => {});
  }, [user, loadingCategories]);

  useEffect(() => {
    if (!user) {
      void Promise.resolve().then(() => setHasTradeInNotification(false));
      return;
    }
    void Promise.resolve().then(() => setHasTradeInNotification(hasPendingTradeInConfirm()));
    const interval = setInterval(() => {
      setHasTradeInNotification(hasPendingTradeInConfirm());
    }, 3000);
    return () => clearInterval(interval);
  }, [user]);

  function applyTheme(t: "dark" | "light") {
    const isLight = t === "light";
    document.documentElement.classList.toggle("light", isLight);
    document.documentElement.style.colorScheme = t;
    const bgColor = isLight ? "#f5f0eb" : "#050505";
    document.documentElement.style.backgroundColor = bgColor;
    const headerColor = isLight ? "#ffffff" : "#000000";

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", headerColor);

    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:10000;pointer-events:none;background:transparent;backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px)";
    document.body.appendChild(overlay);
    let frame = 0;
    const hide = () => {
      frame++;
      if (frame >= 5) {
        overlay.remove();
      } else {
        requestAnimationFrame(hide);
      }
    };
    requestAnimationFrame(hide);
  }

  useEffect(() => {
    applyTheme(theme);
    const id = requestAnimationFrame(() => setSbKey(k => k + 1));
    return () => cancelAnimationFrame(id);
  }, [theme]);

  useEffect(() => {
    if (themePref !== "auto") return;
    const id = setInterval(() => {
      setTheme(getAutoTheme());
    }, 60_000);
    return () => clearInterval(id);
  }, [themePref]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const [gifts, setGifts] = useState<Gift[]>([]);

  const refreshGifts = useCallback(() => {
    if (cart.length === 0) {
      setGifts([]);
      return;
    }
    computeGifts({
      items: cart.map((item) => ({
        product_id: parseInt(item.id),
        quantity: item.quantity,
        price_at_purchase: item.price,
      })),
      total_price: cartTotal,
    })
      .then((res) => setGifts(res.gifts))
      .catch(() => {});
  }, [cart, cartTotal]);

  useEffect(() => {
    const timer = setTimeout(refreshGifts, 400);
    return () => clearTimeout(timer);
  }, [refreshGifts]);

  useEffect(() => {
    if (cartCount > 0) {
      const t = setTimeout(() => setCartBump(true), 0);
      const t2 = setTimeout(() => setCartBump(false), 1000);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [cartCount]);

  useEffect(() => {
    if (user?.role === "admin") void Promise.resolve().then(() => setShowAdmin(true));
    if (user?.role === "courier") void Promise.resolve().then(() => setShowCourier(true));
  }, [user]);

  const handleFlyProgress = useCallback((src: string, fromEl: HTMLElement, p: number) => {
    setFlyState(prev => {
      if (prev) return { ...prev, progress: p };
      return { src, from: fromEl.getBoundingClientRect(), to: cartBtnRef.current?.getBoundingClientRect() ?? null, progress: p, done: false };
    });
  }, []);

  const handleFlyComplete = useCallback((src: string, fromEl: HTMLElement) => {
    setFlyState(prev => {
      if (prev) return { ...prev, progress: 1, done: true };
      return { src, from: fromEl.getBoundingClientRect(), to: cartBtnRef.current?.getBoundingClientRect() ?? null, progress: 1, done: true };
    });
    setTimeout(() => setFlyState(null), 400);
  }, []);

  const handleFlyCancel = useCallback(() => {
    setFlyState(null);
  }, []);

  function addToCart(product: Product) {
    setCart((current) => {
      const exists = current.find((item) => item.id === product.id);
      if (exists) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
  }

  function increaseQuantity(id: string) {
    setCart((current) =>
      current.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decreaseQuantity(id: string) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(id: string) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  function openOrder() {
    setShowOrderModal(true);
    refreshGifts();
  }

  function markCompletedSeen() {
    if (!user) return;
    const seenKey = `seen_completed_orders_${user.id}`;
    fetchOrders({ limit: 100 }).then((data) => {
      const completedIds = data.items.filter((o) => o.status === "completed").map((o) => o.id);
      const seenRaw = localStorage.getItem(seenKey);
      const seen: number[] = seenRaw ? JSON.parse(seenRaw) : [];
      const merged = [...new Set([...seen, ...completedIds])];
      localStorage.setItem(seenKey, JSON.stringify(merged));
    }).catch(() => {});
  }

  function sendToTelegram(delivery: DeliveryData, acceptedGiftNames?: string[]) {
    setOrderSubmitting(true);
    const acceptedSet = new Set(acceptedGiftNames ?? []);
    const acceptedGiftSum = gifts
      .filter((g) => acceptedSet.has(g.name))
      .reduce((sum, g) => sum + (g.price || 0), 0);
    const orderPayload = {
      items: cart.map((item) => ({
        product_id: parseInt(item.id),
        quantity: item.quantity,
        price_at_purchase: item.price,
        selected_attributes: item.attributes ?? null,
      })),
      total_price: cartTotal + acceptedGiftSum,
      customer_name: delivery.customerName,
      delivery_info: delivery.address,
      delivery_lat: delivery.lat,
      delivery_lng: delivery.lng,
      phone: delivery.phone,
      trade_in: delivery.tradeIn,
      trade_in_description: delivery.tradeInDescription || null,
      trade_in_photos: delivery.tradeInPhotos,
      comment: delivery.comment || null,
      accepted_gift_names: acceptedGiftNames ?? null,
    };
    createOrder(orderPayload)
      .then((order) => {
        const ids = JSON.parse(localStorage.getItem("order_ids") || "[]") as number[];
        ids.push(order.id);
        localStorage.setItem("order_ids", JSON.stringify(ids));

        if (delivery.tradeIn) {
          const tradeInData = JSON.parse(localStorage.getItem("trade_in_data") || "{}") as Record<number, { description: string; photos: string[] }>;
          tradeInData[order.id] = {
            description: delivery.tradeInDescription,
            photos: delivery.tradeInPhotos,
          };
          localStorage.setItem("trade_in_data", JSON.stringify(tradeInData));
        }

        setCart([]);
        setActiveTab("home");
        setSelectedCategory(null);
        setSelectedVariants(null);
        setShowOrderModal(false);
        setLastCreatedOrderId(order.id);
      })
      .catch((err) => {
        console.error("Failed to create order:", err);
        setShowOrderModal(false);
      })
      .finally(() => setOrderSubmitting(false));
  }

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemePref(next);
    try { localStorage.setItem(THEME_PREF_KEY, next); } catch (e) { console.warn("Failed to save theme pref:", e); }
  }, [theme]);

  const closeMyOrders = useCallback(() => {
    setShowMyOrders(false);
    if (user) {
      markOrdersRead().catch(() => {});
      fetchOrdersUnread().then((r) => setHasOrdersNotification(r.unread)).catch(() => {});
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)] flex items-center justify-center">
        <div className="hero-glow" />
        <div className="text-[var(--c-text-50)] text-sm">Загрузка...</div>
      </div>
    );
  }

  if (showAdmin) {
    return <AdminPage onClose={() => { setShowAdmin(false); logout(); }} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (showCourier) {
    return <CourierPage onClose={() => { setShowCourier(false); logout(); setHasNotification(false); setHasTradeInNotification(false); }} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (lastCreatedOrderId !== null) {
    return (
      <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)]">
        <div className="hero-glow" />
        <header className="sticky top-0 z-20 border-b border-[var(--c-border)] bg-[var(--c-bg-header)] backdrop-blur-xl">
          <div className="mx-auto grid max-w-7xl grid-cols-3 items-center gap-4 px-4 py-4">
            <div />
            <div className="flex justify-center">
              <Logo />
            </div>
            <div />
          </div>
        </header>
        <main>
          <OrderSuccessPage
            orderId={lastCreatedOrderId}
            onBack={() => setLastCreatedOrderId(null)}
          />
        </main>
      </div>
    );
  }

  if (showMyOrders) {
    return (
      <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)]">
        <div className="hero-glow" />
        <header className="sticky top-0 z-20 border-b border-[var(--c-border)] bg-[var(--c-bg-header)] backdrop-blur-xl">
          <div className="mx-auto grid max-w-7xl grid-cols-3 items-center gap-4 px-4 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={closeMyOrders}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            </div>
            <div className="flex justify-center">
              <Logo />
            </div>
            <div />
          </div>
        </header>
        <main>
          <MyOrdersPage
            onBack={closeMyOrders}
            onOpenReviews={() => {
              closeMyOrders();
              setOpenReviewFormOnOpen(true);
              setShowReviews(true);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-text)]">
      <div key={sbKey} style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", opacity: 0, backdropFilter: "blur(0px)", WebkitBackdropFilter: "blur(0px)" }} />
      <div className="hero-glow" />
      <header className="sticky top-0 z-20 border-b border-[var(--c-border)] bg-[var(--c-bg-header)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-3 items-center gap-4 px-4 py-4">
          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <button
                onClick={() => setShowAdmin(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)] active:scale-95"
                aria-label="Админ-панель"
              >
                <Shield size={20} />
              </button>
            )}
            <button
              onClick={() => setShowAccountSheet(true)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition active:scale-95 ${
                user
                  ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] hover:bg-[var(--c-surface-hover)]"
              }`}
              aria-label="Аккаунт"
            >
              <User size={20} />
              {user && (hasNotification || hasTradeInNotification || hasOrdersNotification) && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#fbbf24] text-black shadow-md">
                  <Bell size={10} />
                </span>
              )}
            </button>
            {(selectedVariants || selectedCategory || showCart || showReviews) ? (
              <button
                onClick={() => {
                  if (showReviews) setShowReviews(false);
                  else if (showCart) setActiveTab("home");
                  else if (selectedVariants) setSelectedVariants(null);
                  else if (selectedCategory) setSelectedCategory(null);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            ) : activeTab === "home" ? (
              <button
                onClick={() => setShowQuestions(true)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
                aria-label="Вопросы"
              >
                <span className="text-lg font-bold">?</span>
                {user && hasSupportNotification && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#fbbf24] text-black shadow-md">
                    <Bell size={10} />
                  </span>
                )}
              </button>
            ) : null}
          </div>

          <div className="flex justify-center">
            <Logo
              onClick={showCart || selectedVariants || selectedCategory || showReviews ? () => { setActiveTab("home"); setSelectedVariants(null); setSelectedCategory(null); setShowReviews(false); } : undefined}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button
              ref={cartBtnRef}
              onClick={() => setActiveTab("cart")}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95 ${cartBump ? "animate-cart-bump" : ""}`}
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--c-accent)] text-[9px] font-bold text-[var(--c-accent-fg)] shadow-md">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {showReviews ? (
        <main className="mx-auto max-w-7xl px-4 py-6">
          <ReviewsPage
            onBack={() => {
              setShowReviews(false);
              setOpenReviewFormOnOpen(false);
              fetchReviews().then((d) => setReviewsCount(d.total)).catch(() => {});
            }}
            onOpenAuth={() => setShowAccountSheet(true)}
            initialOpenForm={openReviewFormOnOpen}
          />
        </main>
      ) : showCart ? (
        <main className="mx-auto max-w-7xl px-4 py-6">
          <CartPage
            cart={cart}
            onIncrease={increaseQuantity}
            onDecrease={decreaseQuantity}
            onRemove={removeFromCart}
            onOrder={openOrder}
          />
        </main>
      ) : selectedVariants ? (
        <ProductPage
          variants={selectedVariants}
          onAddToCart={addToCart}
          onFlyProgress={handleFlyProgress}
          onFlyComplete={handleFlyComplete}
          onFlyCancel={handleFlyCancel}
        />
      ) : selectedCategory ? (
        <main className="mx-auto max-w-7xl px-4 py-6">
          <SubcategoryPage
            categoryName={selectedCategory.name}
            items={selectedCategory.items}
            onSelectProduct={setSelectedVariants}
          />
        </main>
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-6">
          {activeTab === "home" && (
          <section className="mb-8 overflow-hidden rounded-[2rem] border border-[var(--c-border)] bg-[var(--c-surface)] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-4 py-2 text-xs uppercase tracking-[0.35em] text-[var(--c-accent-soft)]">
                Premium selection
              </div>
              <h1 className="text-3xl font-semibold sm:text-4xl">
                Grand Store
              </h1>
              <p className="mt-2 text-base leading-7 text-[var(--c-text-70)]">
                Каталог интернет-магазина
              </p>
              <div className="mt-5 flex items-center gap-3">
                <a href="https://t.me/Grand_Store7" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95" aria-label="Telegram">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </a>
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)] active:scale-95" aria-label="VK">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.055 0C5.398 0 0 5.398 0 12.055c0 6.658 5.398 12.055 12.055 12.055 6.658 0 12.055-5.397 12.055-12.055C24.11 5.398 18.713 0 12.055 0zm6.118 16.972h-1.62c-.63 0-.826-.627-1.958-1.846-.988-1.065-1.418-.083-1.418.886v.674c0 .43-.154.564-.759.6-1.788.114-3.764-.368-5.257-2.069C5.07 12.942 4.11 10.183 4.11 9.944c0-.214.19-.4.766-.4H6.5c.47.045.646.307.776.684.591 1.738 1.508 3.12 1.886 3.12.183 0 .256-.149.256-.746v-2.22c0-1.086-.648-1.174-.648-1.564 0-.23.188-.413.406-.413h2.534c.372 0 .507.2.507.627v2.85c0 .36.194.493.322.493.26 0 .477-.251.843-.652.962-1.057 1.574-2.544 1.574-2.544.115-.238.335-.397.718-.397h1.409c.5 0 .628.298.482.631-.704 1.747-2.326 3.466-2.505 3.679-.26.33-.134.49 0 .782.118.26.533.815.533.815.13.185.266.369.397.54.53.662 1.079 1.22 1.079 1.627.01.472-.385.606-.676.606z"/>
                  </svg>
                </a>
                <button
                  onClick={() => {
                    setOpenReviewFormOnOpen(false);
                    setShowReviews(true);
                  }}
                  className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 text-xs font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)] active:scale-95"
                >
                  <Star size={14} className="fill-[var(--c-accent)] text-[var(--c-accent)]" />
                  Отзывы
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--c-accent)] px-1 text-[10px] font-bold text-[var(--c-accent-fg)]">
                    {reviewsCount}
                  </span>
                </button>
              </div>
            </div>
          </section>
          )}

          <HomePage
            categories={categories}
            loading={loadingCategories}
            onOpenCategory={setSelectedCategory}
          />
        </main>
      )}

      {showOrderModal && (
        <CheckoutModal
          cart={cart}
          total={cartTotal}
          gifts={gifts}
          onSubmit={sendToTelegram}
          onClose={() => setShowOrderModal(false)}
          onOpenAuth={() => setShowAccountSheet(true)}
          submitting={orderSubmitting}
        />
      )}
      {flyState && (() => {
        const to = flyState.to;
        if (!to) return null;
        const p = flyState.progress;
        const fromCenterX = flyState.from.left + flyState.from.width / 2;
        const fromCenterY = flyState.from.top + flyState.from.height / 2;
        const toCenterX = to.left + to.width / 2;
        const toCenterY = to.top + to.height / 2;
        const offset = 24;
        const x = fromCenterX + (toCenterX - fromCenterX) * p - 40 + offset * (1 - p);
        const y = fromCenterY + (toCenterY - fromCenterY) * p - 40 + offset * (1 - p);
        const s = 0.3 + 2.2 * p - 2.35 * p * p;
        const o = flyState.done ? 0 : 1 - p * 0.7;
        return (
          <img
            src={flyState.src}
            className="fixed z-[100] pointer-events-none w-20 h-20 rounded-2xl object-cover shadow-2xl"
            style={{
              left: x,
              top: y,
              transform: `scale(${s})`,
              opacity: o,
              transition: flyState.done ? "all 250ms ease-out" : "none",
            }}
          />
        );
      })()}

      {showAccountSheet && (
        <AuthModal
          user={user}
          onLogin={async (login, password) => {
            const result = await apiLogin({ login, password });
            setAuth(result.token, result.user);
            setShowAccountSheet(false);
            if (result.user.role === "admin") setShowAdmin(true);
            if (result.user.role === "courier") setShowCourier(true);
          }}
          onRegister={async (data) => {
            const result = await apiRegister(data);
            setAuth(result.token, result.user);
            setShowAccountSheet(false);
            if (result.user.role === "admin") setShowAdmin(true);
            if (result.user.role === "courier") setShowCourier(true);
          }}
          onTelegram={async () => {
            const platform = detectPlatform();
            if (platform === "telegram") {
              const initData = getTelegramInitData();
              if (!initData) return;
              const result = await telegramAuth(initData);
              setAuth(result.token, result.user);
              setShowAccountSheet(false);
              if (result.user.role === "admin") setShowAdmin(true);
              if (result.user.role === "courier") setShowCourier(true);
            } else {
              const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME || "your_bot_username";
              const redirectUri = `${window.location.origin}/auth/tg-callback`;
              const url = `https://oauth.telegram.org/auth?bot_id=${botName}&origin=${encodeURIComponent(window.location.origin)}&redirect_uri=${encodeURIComponent(redirectUri)}&embed=1`;
              const w = window.open(url, "telegram-login", "width=400,height=600");
              if (w) {
                const handler = async (e: MessageEvent) => {
                  if (e.origin !== "https://oauth.telegram.org") return;
                  window.removeEventListener("message", handler);
                  try {
                    const result = await telegramBrowserAuth(e.data);
                    setAuth(result.token, result.user);
                    setShowAccountSheet(false);
                    if (result.user.role === "admin") setShowAdmin(true);
                    if (result.user.role === "courier") setShowCourier(true);
                  } catch (e) {
                    console.warn("Telegram browser auth failed:", e);
                  }
                };
                window.addEventListener("message", handler);
              }
            }
          }}
          onVK={async () => {
            const platform = detectPlatform();
            if (platform === "vk") {
              const params = getVKParams();
              if (!params || !params.access_token || !params.user_id) return;
              const result = await vkAuth({ access_token: params.access_token, user_id: params.user_id });
              setAuth(result.token, result.user);
              setShowAccountSheet(false);
              if (result.user.role === "admin") setShowAdmin(true);
              if (result.user.role === "courier") setShowCourier(true);
            } else {
              const appId = import.meta.env.VITE_VK_APP_ID;
              if (!appId) {
                setShowAccountSheet(false);
                window.open("https://id.vk.com/about", "_blank");
                return;
              }
              const redirectUri = `${window.location.origin}/auth/vk-callback`;
              const url = `https://id.vk.com/auth?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&v=1.45`;
              window.location.href = url;
            }
          }}
          onGoogle={async () => {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            if (!clientId) {
              setShowAccountSheet(false);
              window.open("https://console.cloud.google.com/apis/credentials", "_blank");
              return;
            }
            const redirectUri = `${window.location.origin}/auth/callback`;
            const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=openid%20profile%20email&nonce=${Date.now()}`;
            window.location.href = url;
          }}
          onLogout={() => { setShowAccountSheet(false); logout(); setHasNotification(false); setHasTradeInNotification(false); }}
          onClose={() => { setShowAccountSheet(false); }}
          onUpdateProfile={async (field, value) => {
            const result = await updateProfile({ [field]: value || undefined });
            updateUser(result.user);
          }}
          onShowMyOrders={() => {
            setShowAccountSheet(false);
            setShowMyOrders(true);
            setHasNotification(false);
            setHasTradeInNotification(false);
            markOrdersRead().catch(() => {});
            setHasOrdersNotification(false);
            markCompletedSeen();
          }}
          onShowSetPassword={() => { setShowAccountSheet(false); setShowSetPassword(true); }}
          onShowAdmin={() => { setShowAccountSheet(false); setShowAdmin(true); }}
          onShowCourier={() => { setShowAccountSheet(false); setShowCourier(true); }}
          hasNotification={hasNotification}
          hasTradeInNotification={hasTradeInNotification}
          hasOrdersNotification={hasOrdersNotification}
        />
      )}

      {showSetPassword && (
        <SetPasswordModal
          onClose={() => setShowSetPassword(false)}
          onSuccess={(updatedUser) => {
            if (updatedUser) updateUser(updatedUser);
          }}
        />
      )}

      {showQuestions && (
        <QuestionsModal
          onClose={() => {
            setShowQuestions(false);
            if (user) {
              fetchSupportUnread().then((r) => setHasSupportNotification(r.unread)).catch(() => {});
            }
          }}
          onOpenAuth={() => {
            setShowQuestions(false);
            setShowAccountSheet(true);
          }}
          isAuthed={!!user}
        />
      )}
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
