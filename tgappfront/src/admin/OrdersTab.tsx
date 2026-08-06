import { useState, useEffect, useCallback, useRef } from "react";
import { DateRangePicker } from "./DateRangePicker";
import { fetchOrders, updateOrderStatus, deleteOrder, updateOrderTradeInPrice, fetchCouriers, createCourier, deleteCourier, updateCourier, assignCourier, type ApiOrder, type CourierInfo } from "../api/orders";
import { formatPrice, formatDate, formatDateTime } from "../utils/format";
import { ATTR_LABELS, STATUS_LABELS, STATUS_COLORS, type OrderStatus } from "../utils/labels";
import { mergeTradeInData, mergeTradeInSingle, saveTradeInForOrder, getTradeInStatus } from "../utils/tradeIn";
import { PhoneInput } from "../components/PhoneInput";
import { Truck, Trash2, X, Package, Archive, Copy, Calendar, Table, BarChart3, FileSpreadsheet, ChevronLeft, ChevronRight, Pencil, List } from "lucide-react";
import { onWsEvent } from "../api/socket";
import * as XLSX from "xlsx";

type SubTab = "list" | "delivery" | "archive";

function MiniChart({ data, labels, color, isPrice }: { data: number[]; labels: string[]; color?: string; isPrice?: boolean }) {
  const barColor = color || "var(--c-accent)";
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const ticks = 4;
  const w = 280;
  const h = 140;
  const ml = 40;
  const mb = 24;
  const mt = 8;
  const mr = 8;
  const cw = w - ml - mr;
  const ch = h - mt - mb;
  const barW = Math.max(4, Math.min(20, cw / data.length - 4));
  const gap = (cw - barW * data.length) / (data.length + 1);

  function fmtVal(v: number) {
    if (isPrice) {
      if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
      if (v >= 1000) return (v / 1000).toFixed(0) + "K";
      return String(Math.round(v));
    }
    return String(Math.round(v));
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" style={{ height: 140 }}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const val = (max / ticks) * i;
        const y = mt + ch - (i / ticks) * ch;
        return (
          <g key={i}>
            <line x1={ml} y1={y} x2={w - mr} y2={y} stroke="var(--c-border)" strokeWidth="0.5" />
            <text x={ml - 4} y={y + 3} textAnchor="end" fill="var(--c-text-40)" fontSize="8">
              {fmtVal(val)}
            </text>
          </g>
        );
      })}
      <line x1={ml} y1={mt} x2={ml} y2={mt + ch} stroke="var(--c-border)" strokeWidth="0.5" />
      <line x1={ml} y1={mt + ch} x2={w - mr} y2={mt + ch} stroke="var(--c-border)" strokeWidth="0.5" />
      {data.map((v, i) => {
        const barH = max > 0 ? (v / max) * ch : 0;
        const x = ml + gap + i * (barW + gap);
        const y = mt + ch - barH;
        const label = labels[i] ?? "";
        const shortLabel = label.length > 5 ? label.slice(5) : label;
        return (
          <g key={i}>
            <rect
              x={x}
              y={mt + ch}
              width={barW}
              height={0}
              rx={2}
              fill={barColor}
              opacity={0.8}
            >
              <animate
                attributeName="height"
                from="0"
                to={String(barH)}
                dur="0.6s"
                begin={`${i * 0.08}s`}
                fill="freeze"
                calcMode="spline"
                keySplines="0.25 0.1 0.25 1"
                keyTimes="0;1"
              />
              <animate
                attributeName="y"
                from={String(mt + ch)}
                to={String(y)}
                dur="0.6s"
                begin={`${i * 0.08}s`}
                fill="freeze"
                calcMode="spline"
                keySplines="0.25 0.1 0.25 1"
                keyTimes="0;1"
              />
            </rect>
            {data.length <= 10 && (
              <text
                x={x + barW / 2}
                y={mt + ch + 12}
                textAnchor="middle"
                fill="var(--c-text-40)"
                fontSize="7"
              >
                {shortLabel}
              </text>
            )}
          </g>
        );
      })}
      {data.length > 10 && (
        <>
          <text x={ml} y={mt + ch + 12} textAnchor="start" fill="var(--c-text-40)" fontSize="7">{labels[0]?.slice(5)}</text>
          <text x={w - mr} y={mt + ch + 12} textAnchor="end" fill="var(--c-text-40)" fontSize="7">{labels[labels.length - 1]?.slice(5)}</text>
        </>
      )}
    </svg>
  );
}

const subTabLabels: Record<SubTab, string> = {
  list: "Список",
  delivery: "Доставка",
  archive: "Архив",
};

function loadOrderIds(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveOrderIds(key: string, ids: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

function parseDate(dateStr: string): Date {
  const parts = dateStr.includes("-") ? dateStr.split("-") : dateStr.split(".");
  if (dateStr.includes("-")) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d);
  }
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d);
}

export function OrdersTab() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tradeInPriceEdit, setTradeInPriceEdit] = useState<Record<number, string>>({});
  const [savingPriceId, setSavingPriceId] = useState<number | null>(null);
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);
  const [photoViewerIdx, setPhotoViewerIdx] = useState(0);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState<string[]>([]);
  const [fabOpenId, setFabOpenId] = useState<number | null>(null);
  const [statusMenuId, setStatusMenuId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<number | null>(null);
  const [deliveryConfirmId, setDeliveryConfirmId] = useState<number | null>(null);
  const [showReassignConfirm, setShowReassignConfirm] = useState<number | null>(null);
  const [couriers, setCouriers] = useState<CourierInfo[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);
  const [addingCourier, setAddingCourier] = useState(false);
  const [newCourierName, setNewCourierName] = useState("");
  const [newCourierPhone, setNewCourierPhone] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [editingCourierId, setEditingCourierId] = useState<number | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [editingCourierName, setEditingCourierName] = useState("");
  const [editingCourierPhone, setEditingCourierPhone] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("list");
  const [archiveView, setArchiveView] = useState<"cards" | "table" | "stats">("cards");
  const [archivePage, setArchivePage] = useState(0);
  const ARCHIVE_PAGE_SIZE = 50;
  const [deliveryIds, setDeliveryIds] = useState<Set<number>>(() => loadOrderIds("admin_delivery_orders"));
  const [archiveIds, setArchiveIds] = useState<Set<number>>(() => loadOrderIds("admin_archive_orders"));
  const fabRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveOrderIds("admin_delivery_orders", deliveryIds); }, [deliveryIds]);
  useEffect(() => { saveOrderIds("admin_archive_orders", archiveIds); }, [archiveIds]);

  function copyToClipboard(text: string, label: string) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setCopyToast(label);
    setTimeout(() => setCopyToast(null), 1500);
  }

  const isArchivedOrder = useCallback((o: ApiOrder) => archiveIds.has(o.id) || !!o.archived_at, [archiveIds]);

  const orderDate = useCallback(
    (o: ApiOrder) => {
      if (isArchivedOrder(o)) return o.delivered_at ?? o.archived_at ?? o.created_at;
      return o.created_at;
    },
    [isArchivedOrder],
  );

  const loadOrders = useCallback(async () => {
    try {
      const params: { limit?: number } = { limit: 200 };
      const data = await fetchOrders(params);
      let filtered = data.items;
      if (dateFrom) {
        const from = parseDate(dateFrom);
        filtered = filtered.filter((o) => new Date(orderDate(o)) >= from);
      }
      if (dateTo) {
        const to = parseDate(dateTo);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter((o) => new Date(orderDate(o)) <= to);
      }
      setOrders(mergeTradeInData(filtered));
    } catch (e) {
      console.error("Failed to load orders:", e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, orderDate]);

  useEffect(() => {
    void (async () => { await loadOrders(); })();
  }, [loadOrders]);

  // WebSocket listener for real-time order updates
  useEffect(() => {
    const unsub = onWsEvent("order_updated", () => {
      loadOrders();
    });
    return unsub;
  }, [loadOrders]);

  useEffect(() => {
    if (fabOpenId === null) return;
    function handleClick(e: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) setFabOpenId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [fabOpenId]);

  useEffect(() => {
    if (statusMenuId === null) return;
    function handleClick(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusMenuId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [statusMenuId]);

  async function loadCouriers() {
    try {
      const list = await fetchCouriers();
      setCouriers(list);
      for (const c of list) {
        if (c.password) saveCourierCreds(c.id, c.login, c.password);
      }
    } catch (e) {
      console.error("Failed to load couriers:", e);
    }
  }

  async function handleAssignCourier(orderId: number, courierId: number) {
    setAssigning(true);
    try {
      await assignCourier(orderId, courierId);
      const courier = couriers.find((c) => c.id === courierId);
      if (courier) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, courier_id: courier.id, courier_name: courier.name, courier_phone: courier.phone, courier_login: courier.login }
              : o
          )
        );
      }
      setDeliveryIds((prev) => new Set([...prev, orderId]));
      setFabOpenId(null);
      setDeliveryConfirmId(null);
      setSelectedCourierId(null);
    } catch (e) {
      console.error("Failed to assign courier:", e);
    } finally {
      setAssigning(false);
    }
  }

  function saveCourierCreds(id: number, login: string, password: string) {
    try {
      const raw = localStorage.getItem("courier_creds");
      const map = raw ? JSON.parse(raw) : {};
      map[id] = { login, password };
      localStorage.setItem("courier_creds", JSON.stringify(map));
    } catch (e) {
      console.warn("Failed to save courier credentials:", e);
    }
  }

  function getCourierCreds(id: number): { login: string; password: string } | null {
    try {
      const raw = localStorage.getItem("courier_creds");
      const map = raw ? JSON.parse(raw) : {};
      return map[id] ?? null;
    } catch { return null; }
  }

  async function handleSaveCourierEdit(courierId: number) {
    try {
      const updated = await updateCourier(courierId, { name: editingCourierName.trim(), phone: editingCourierPhone.trim() || undefined });
      setCouriers((prev) => prev.map((c) => c.id === courierId ? { ...c, name: updated.name, phone: updated.phone } : c));
      setEditingCourierId(null);
    } catch (e) {
      console.error("Failed to update courier:", e);
    }
  }

  async function handleCreateCourier() {
    if (!newCourierName.trim()) return;
    try {
      const created = await createCourier({ name: newCourierName.trim(), phone: newCourierPhone.trim() || undefined });
      setCouriers((prev) => [created, ...prev]);
      setSelectedCourierId(created.id);
      saveCourierCreds(created.id, created.login, created.password);
      setNewCourierName("");
      setNewCourierPhone("");
      setAddingCourier(false);
    } catch (e) {
      console.error("Failed to create courier:", e);
    }
  }

  async function handleDeleteCourier(courierId: number) {
    try {
      await deleteCourier(courierId);
      setCouriers((prev) => prev.filter((c) => c.id !== courierId));
      if (selectedCourierId === courierId) setSelectedCourierId(null);
    } catch (e) {
      console.error("Failed to delete courier:", e);
    }
  }

  function moveToArchive(orderId: number) {
    setArchiveIds((prev) => new Set([...prev, orderId]));
    setDeliveryIds((prev) => { const n = new Set(prev); n.delete(orderId); return n; });
    updateOrderStatus(orderId, "completed").catch(() => {});
  }

  async function handleChangeStatus(orderId: number, newStatus: string) {
    try {
      const updated = await updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? mergeTradeInSingle({ ...o, ...updated }) : o))
      );
      setFabOpenId(null);
    } catch (e) {
      console.error("Failed to update order status:", e);
    }
  }

  async function handleDeleteOrder(orderId: number) {
    try {
      await deleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setDeliveryIds((prev) => { const n = new Set(prev); n.delete(orderId); return n; });
      setArchiveIds((prev) => { const n = new Set(prev); n.delete(orderId); return n; });
    } catch (e) {
      console.error("Failed to delete order:", e);
    }
  }

  async function handleSaveTradeInPrice(orderId: number) {
    const raw = tradeInPriceEdit[orderId];
    if (!raw) return;
    const price = parseInt(raw.replace(/\D/g, ""), 10);
    if (isNaN(price) || price < 0) return;
    setSavingPriceId(orderId);

    saveTradeInForOrder(orderId, { price, status: "pending_confirm", priceSetAt: new Date().toISOString() });

    await updateOrderTradeInPrice(orderId, price).catch(() => {});

    setOrders((prev) => prev.map((o) => {
      if (o.id !== orderId) return o;
      return mergeTradeInSingle({ ...o, trade_in_price: price });
    }));
    setTradeInPriceEdit((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
    setSavingPriceId(null);
  }

  const visibleOrders = orders.filter((o) => {
    const isArchived = isArchivedOrder(o);
    if (activeSubTab === "list") return !deliveryIds.has(o.id) && !isArchived;
    if (activeSubTab === "delivery") return deliveryIds.has(o.id) && !isArchived;
    if (activeSubTab === "archive") return isArchived;
    return true;
  });

  const archiveTablePage = visibleOrders.slice(archivePage * ARCHIVE_PAGE_SIZE, (archivePage + 1) * ARCHIVE_PAGE_SIZE);
  const archiveTablePages = Math.ceil(visibleOrders.length / ARCHIVE_PAGE_SIZE);

  function exportArchiveExcel() {
    const header = ["Дата", "ФИО", "Телефон", "Никнейм", "Почта", "Товар", "IMEI/Серийный", "Закупка", "Продажа"];
    const rows: (string | number)[][] = visibleOrders.map((o) => {
      const item = o.items[0];
      const product = item?.product;
      const imei = item?.selected_attributes && "imei" in item.selected_attributes
        ? String(item.selected_attributes.imei)
        : "";
      return [
        formatDate(orderDate(o)),
        o.customer_name || "",
        o.phone || "",
        o.user_username || "",
        o.user_email || "",
        product?.name || item?.product_name || (item?.product_id ? `Товар #${item.product_id}` : "—"),
        imei,
        item?.purchase_price != null ? item.purchase_price : "",
        item?.price_at_purchase != null ? item.price_at_purchase : o.total_price,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [
      { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 26 },
      { wch: 40 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
    ];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) cell.s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Архив");

    const today = new Date().toISOString().slice(0, 10);
    const fname = dateFrom || dateTo
      ? `archive_${dateFrom || "start"}_${dateTo || "now"}.xlsx`
      : `archive_${today}.xlsx`;
    XLSX.writeFile(wb, fname);
  }

  const archiveStats = (() => {
    const total = visibleOrders.length;
    const totalRevenue = visibleOrders.reduce((s, o) => s + o.total_price, 0);
    const totalPurchase = visibleOrders.reduce((s, o) => s + o.items.reduce((is2, i) => is2 + (i.purchase_price ?? 0) * i.quantity, 0), 0);
    const profit = totalRevenue - totalPurchase;
    const avgOrder = total > 0 ? totalRevenue / total : 0;
    const tradeInCount = visibleOrders.filter((o) => o.trade_in).length;
    const uniqueProducts = new Set(visibleOrders.flatMap((o) => o.items.map((i) => i.product_id))).size;

    const dayMap = new Map<string, { count: number; revenue: number; purchase: number; tradeIn: number }>();
    for (const o of visibleOrders) {
      const day = orderDate(o).slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, { count: 0, revenue: 0, purchase: 0, tradeIn: 0 });
      const d = dayMap.get(day)!;
      d.count++;
      d.revenue += o.total_price;
      d.purchase += o.items.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0);
      if (o.trade_in) d.tradeIn++;
    }
    const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const chartOrders = sortedDays.map(([, d]) => d.count);
    const chartRevenue = sortedDays.map(([, d]) => d.revenue);
    const chartPurchase = sortedDays.map(([, d]) => d.purchase);
    const chartProfit = sortedDays.map(([, d]) => d.revenue - d.purchase);
    const chartAvg = sortedDays.map(([, d]) => d.count > 0 ? d.revenue / d.count : 0);
    const chartTradeIn = sortedDays.map(([, d]) => d.tradeIn);

    const dayLabels = sortedDays.map(([d]) => d);
    return { total, totalRevenue, totalPurchase, profit, avgOrder, tradeInCount, uniqueProducts, chartOrders, chartRevenue, chartPurchase, chartProfit, chartAvg, chartTradeIn, dayLabels };
  })();

  function renderOrderCard(order: ApiOrder) {
    const isExpanded = expandedId === order.id;
    const inDelivery = deliveryIds.has(order.id);
    const inArchive = isArchivedOrder(order);

    return (
      <div
        key={order.id}
        className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 transition hover:bg-[var(--c-surface-hover)]"
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="font-semibold text-[var(--c-text)]">#{order.id}</span>
            {activeSubTab === "delivery" ? (
              <span className="ml-3 inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-0.5 text-xs font-medium text-blue-300">
                <Truck size={12} /> В доставке
              </span>
            ) : activeSubTab === "archive" ? (
              <span className={`ml-3 inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status as OrderStatus]}`}>
                {STATUS_LABELS[order.status as OrderStatus]}
              </span>
            ) : (
              <span className={`ml-3 inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status as OrderStatus]}`}>
                {STATUS_LABELS[order.status as OrderStatus]}
              </span>
            )}
            {order.trade_in && (
              <span className="ml-2 inline-flex items-center rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 py-0.5 text-xs font-medium text-[var(--c-accent-soft)]">
                Trade-In
                {(() => {
                  const tiStatus = getTradeInStatus(order.id);
                  if (tiStatus === "pending_confirm") return <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-yellow-400" />;
                  if (tiStatus === "confirmed") return <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-400" />;
                  if (tiStatus === "rejected") return <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-400" />;
                  return <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[var(--c-text-40)]" />;
                })()}
              </span>
            )}
          </div>
          {activeSubTab === "archive" ? (
            <div className="text-right text-xs text-[var(--c-text-50)] space-y-0.5">
              <div>Создан: <span className="font-medium text-[var(--c-text-70)]">{formatDate(order.created_at)}</span></div>
              <div>Доставлен: <span className="font-medium text-[var(--c-success-soft)]">{formatDateTime(orderDate(order))}</span></div>
            </div>
          ) : (
            <span className="text-sm text-[var(--c-text-50)]">{formatDate(order.created_at)}</span>
          )}
        </div>
        <div className="grid gap-1 text-sm">
          {order.customer_name && (
            <div className="flex items-center gap-2 text-[var(--c-text-70)]">
              <span className="w-20 text-[var(--c-text-50)]">ФИО:</span>
              <span className="font-medium">{order.customer_name}</span>
            </div>
          )}
          {order.delivery_info && (
            <div className="flex items-center gap-2 text-[var(--c-text-70)]">
              <span className="w-20 text-[var(--c-text-50)]">Адрес:</span>
              <span className="font-medium">{order.delivery_info}</span>
            </div>
          )}
          {order.phone && (
            <div className="flex items-center gap-2 text-[var(--c-text-70)]">
              <span className="w-20 text-[var(--c-text-50)]">Тел:</span>
              <a href={`tel:${order.phone}`} className="font-medium text-[var(--c-accent-soft)] hover:underline">{order.phone}</a>
            </div>
          )}
          <div className="flex items-center gap-2 text-[var(--c-text-70)]">
            <span className="w-20 text-[var(--c-text-50)]">Товары:</span>
            <span>
              {order.items.map((item) => {
                const name = item.product?.name ?? item.product_name ?? `Товар #${item.product_id}`;
                return `${name} x${item.quantity}`;
              }).join(", ")}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 border-t border-[var(--c-border)] pt-3 space-y-2">
            {order.items.map((item) => {
              const product = item.product;
              const mainImg = item.product_image
                ?? product?.images?.find((i) => i.is_main)?.image_url
                ?? product?.images?.[0]?.image_url;
              return (
                <div key={item.id} className="flex gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] p-3">
                  {mainImg && (
                    <img src={mainImg} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium truncate">{product?.name ?? item.product_name ?? `Товар #${item.product_id}`}</div>
                    {item.selected_attributes && Object.keys(item.selected_attributes).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(item.selected_attributes).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-0.5 rounded-md border border-[var(--c-border)] bg-[var(--c-surface)] px-1.5 py-0.5 text-[10px] text-[var(--c-text-60)]">
                            <span className="text-[var(--c-text-40)]">{ATTR_LABELS[k] ?? k}:</span>
                            <span className="text-[var(--c-text-80)]">{String(v)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-[var(--c-text-50)]">
                      {item.quantity} шт. x {formatPrice(item.price_at_purchase)}
                    </div>
                  </div>
                </div>
              );
            })}

            {order.gifts && order.gifts.length > 0 && (
              <div className="rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-accent-strong)]">
                  {order.gifts.length === 1 ? "Подарок за покупку" : `Подарки за покупку (${order.gifts.length})`}
                </div>
                <div className="space-y-2">
                  {order.gifts.map((g, idx) => (
                    <div key={`${g.name}-${idx}`} className="flex items-center gap-3 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-surface)] p-2.5">
                      {g.image && <img src={g.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                      <div className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--c-text)]">{g.name}</div>
                      <span className="whitespace-nowrap text-sm font-semibold text-[var(--c-accent-strong)]">
                        {g.price > 0 ? formatPrice(g.price) : "Бесплатно"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSubTab === "delivery" && (order.courier_name || order.courier_id) && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-300">Курьер</span>
                  <button
                    onClick={() => setShowReassignConfirm(order.id)}
                    className="text-[10px] text-blue-300 hover:text-blue-200 underline transition"
                  >Заменить</button>
                </div>
                {order.courier_name && <div className="text-xs text-[var(--c-text)]">{order.courier_name}</div>}
                {order.courier_phone && <div className="text-xs text-[var(--c-text-60)]">+7 {order.courier_phone}</div>}
                {order.courier_id && (() => {
                  const creds = getCourierCreds(order.courier_id!);
                  const pw = creds?.password;
                  return (
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--c-text-50)]">Логин:</span>
                        <code className="flex-1 rounded bg-[var(--c-surface)] px-2 py-0.5 text-[10px] text-[var(--c-text)] font-mono">{order.courier_login || (creds?.login ?? "—")}</code>
                        <button onClick={() => copyToClipboard(order.courier_login || creds?.login || "", "Логин скопирован")} className="text-[var(--c-text-40)] hover:text-[var(--c-text-70)]"><Copy size={10} /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--c-text-50)]">Пароль:</span>
                        <code className="flex-1 rounded bg-[var(--c-surface)] px-2 py-0.5 text-[10px] text-[var(--c-text)] font-mono">{pw || "—"}</code>
                        <button onClick={() => copyToClipboard(pw || "", "Пароль скопирован")} className="text-[var(--c-text-40)] hover:text-[var(--c-text-70)]"><Copy size={10} /></button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {order.trade_in && (
              <div className="rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--c-accent-soft)]">Trade-In</span>
                  {(() => {
                    const tiStatus = getTradeInStatus(order.id);
                    if (tiStatus === "pending_confirm") return <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-300">Ожидает подтверждения</span>;
                    if (tiStatus === "confirmed") return <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-300">Подтверждено</span>;
                    if (tiStatus === "rejected") return <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300">Отклонено</span>;
                    return null;
                  })()}
                </div>
                {order.trade_in_description && (
                  <p className="text-xs text-[var(--c-accent-soft)] opacity-80">{order.trade_in_description}</p>
                )}
                {order.trade_in_photos && order.trade_in_photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {order.trade_in_photos.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover cursor-pointer border border-[var(--c-accent-border)] transition hover:opacity-80"
                        onClick={() => { setPhotoViewerPhotos(order.trade_in_photos); setPhotoViewerIdx(idx); setPhotoViewerUrl(url); }}
                      />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-[var(--c-accent-soft)]">Оценка:</span>
                  {tradeInPriceEdit[order.id] !== undefined ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={tradeInPriceEdit[order.id]}
                        onChange={(e) => setTradeInPriceEdit((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveTradeInPrice(order.id)}
                        className="w-28 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-1 text-xs text-[var(--c-text)] outline-none focus:border-[var(--c-accent-border)]"
                        placeholder="Цена ₽"
                      />
                      <button
                        onClick={() => handleSaveTradeInPrice(order.id)}
                        disabled={savingPriceId === order.id}
                        className="rounded-lg bg-[var(--c-accent)] px-2 py-1 text-[10px] font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] disabled:opacity-50"
                      >
                        {savingPriceId === order.id ? "..." : "OK"}
                      </button>
                      <button
                        onClick={() => setTradeInPriceEdit((prev) => { const n = { ...prev }; delete n[order.id]; return n; })}
                        className="rounded-lg border border-[var(--c-border)] px-2 py-1 text-[10px] text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)]"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {order.trade_in_price != null ? (
                        <span className="text-xs font-semibold text-[var(--c-accent-soft)]">{formatPrice(order.trade_in_price)}</span>
                      ) : (
                        <span className="text-xs text-[var(--c-accent-soft)] opacity-60">Не определена</span>
                      )}
                      <button
                        onClick={() => setTradeInPriceEdit((prev) => ({ ...prev, [order.id]: order.trade_in_price != null ? String(order.trade_in_price) : "" }))}
                        className="rounded-lg border border-[var(--c-accent-border)] px-2 py-1 text-[10px] font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-bg)]"
                      >
                        {order.trade_in_price != null ? "Изменить" : "Указать"}
                      </button>
                    </div>
                  )}
                </div>
                </div>
                  )}
          </div>
              )}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--c-border)] pt-3">
          {order.trade_in && order.trade_in_price != null ? (
            <span className="font-semibold text-[var(--c-accent-soft)]">{formatPrice(order.trade_in_price)}</span>
          ) : order.trade_in ? (
            <span className="text-sm text-[var(--c-accent-soft)]">Ожидает оценки</span>
          ) : (
            <span className="font-semibold text-[var(--c-accent-soft)]">{formatPrice(order.total_price)}</span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpandedId(isExpanded ? null : order.id)}
              className="h-8 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-xs font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
            >
              {isExpanded ? "Свернуть" : "Детали"}
            </button>
            <div className="flex items-center gap-1">
              <div className="relative flex items-center gap-1" ref={fabOpenId === order.id || statusMenuId === order.id ? fabRef : undefined}>
                {statusMenuId === order.id && (
                  <div className="absolute right-full top-1/2 -translate-y-1/2 z-20 mr-2 flex gap-2">
                    {(Object.keys(STATUS_LABELS) as OrderStatus[]).filter((s) => s !== "cancelled").map((s) => (
                      <button
                        key={s}
                        onClick={() => handleChangeStatus(order.id, s)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                          order.status === s
                            ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                            : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] hover:bg-[var(--c-surface-hover)]"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                )}
                {fabOpenId === order.id && (
                  <>
                    {!inDelivery && !inArchive && (
                      <button
                        onClick={async () => { await loadCouriers(); setSelectedCourierId(null); setDeliveryConfirmId(order.id); }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
                      >
                        <Truck size={14} />
                      </button>
                    )}
                    {inDelivery && !inArchive && (
                      <button
                        onClick={() => setArchiveConfirmId(order.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
                      >
                        <Archive size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirmId(order.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    if (fabOpenId === order.id) { setFabOpenId(null); setStatusMenuId(null); }
                    else setFabOpenId(order.id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] active:scale-95"
                >
                  {fabOpenId === order.id ? (
                    <X size={14} />
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="block h-0.5 w-3.5 rounded-full bg-current" />
                      <span className="block h-0.5 w-3.5 rounded-full bg-current" />
                      <span className="block h-0.5 w-3.5 rounded-full bg-current" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const subTabCounts = {
    list: orders.filter((o) => !deliveryIds.has(o.id) && !isArchivedOrder(o)).length,
    delivery: orders.filter((o) => deliveryIds.has(o.id) && !isArchivedOrder(o)).length,
    archive: orders.filter((o) => isArchivedOrder(o)).length,
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {(["list", "delivery", "archive"] as SubTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveSubTab(tab); setArchivePage(0); }}
              className={`flex h-9 items-center rounded-xl border px-2.5 text-xs font-medium transition active:scale-95 ${
                activeSubTab === tab
                  ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"
              }`}
            >
              <span className={`inline-flex transition-all duration-300 ${activeSubTab === tab ? "mr-1.5" : ""}`}>
                {tab === "list" && <List size={14} />}
                {tab === "delivery" && <Truck size={14} />}
                {tab === "archive" && <Archive size={14} />}
              </span>
              <span
                className="overflow-hidden whitespace-nowrap transition-all duration-300"
                style={{
                  maxWidth: activeSubTab === tab ? "90px" : "0px",
                  opacity: activeSubTab === tab ? 1 : 0,
                  transform: `translateX(${activeSubTab === tab ? "0px" : "-6px"})`,
                }}
              >
                {subTabLabels[tab]}
              </span>
              {activeSubTab === tab && (
                <span className="ml-1.5 rounded-full bg-[var(--c-text-40)]/20 px-1.5 py-0.5 text-[10px]">{subTabCounts[tab]}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95 ${
            showFilters
              ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
              : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] hover:bg-[var(--c-surface-hover)] dark:border-[var(--c-accent-border)] dark:bg-[var(--c-accent-bg)] dark:text-[var(--c-accent-soft)]"
          }`}
          aria-label="Фильтры"
        >
          <Calendar size={20} />
        </button>
      </div>

      <p className="mb-4 text-sm text-[var(--c-text-50)]">
        {activeSubTab === "list" && `Всего заказов: ${subTabCounts.list}`}
        {activeSubTab === "delivery" && `В доставке: ${subTabCounts.delivery}`}
        {activeSubTab === "archive" && `В архиве: ${subTabCounts.archive}`}
      </p>

      {activeSubTab === "archive" && (
        <div className="mb-4 flex items-center gap-2">
          {([
            { key: "cards" as const, icon: <Package size={16} />, label: "Карточки" },
            { key: "table" as const, icon: <Table size={16} />, label: "Таблица" },
            { key: "stats" as const, icon: <BarChart3 size={16} />, label: "Статистика" },
          ]).map((v) => (
            <button
              key={v.key}
              onClick={() => setArchiveView(v.key)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition active:scale-95 ${
                archiveView === v.key
                  ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"
              }`}
              title={v.label}
            >
              {v.icon}
            </button>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="mb-4 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 space-y-3">
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onFromChange={(v) => { setDateFrom(v); setArchivePage(0); }}
            onToChange={(v) => { setDateTo(v); setArchivePage(0); }}
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); setArchivePage(0); }}
              className="rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-3 py-1.5 text-xs text-[var(--c-danger)] transition hover:opacity-80"
            >
              Сбросить
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--c-text-50)] text-center py-8">Загрузка заказов...</p>
      ) : activeSubTab === "archive" && archiveView === "table" ? (
        <>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--c-text-50)]">Таблица архива</p>
          <button
            onClick={exportArchiveExcel}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[#1d5c38] bg-[#217346] px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95"
            title="Экспорт в Excel"
          >
            <FileSpreadsheet size={14} />
            Excel
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--c-border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-[var(--c-border)] bg-[var(--c-surface-alt)]">
                  <th className="px-3 py-2.5 text-left text-[var(--c-text-50)] font-medium">Дата</th>
                  <th className="px-3 py-2.5 text-left text-[var(--c-text-50)] font-medium">ФИО</th>
                  <th className="px-3 py-2.5 text-left text-[var(--c-text-50)] font-medium">Телефон</th>
                  <th className="px-3 py-2.5 text-left text-[var(--c-text-50)] font-medium">Никнейм</th>
                  <th className="px-3 py-2.5 text-left text-[var(--c-text-50)] font-medium">Почта</th>
                  <th className="px-3 py-2.5 text-left text-[var(--c-text-50)] font-medium">Товар</th>
                  <th className="px-3 py-2.5 text-left text-[var(--c-text-50)] font-medium">IMEI/Серийный</th>
                  <th className="px-3 py-2.5 text-right text-[var(--c-text-50)] font-medium">Закупка</th>
                  <th className="px-3 py-2.5 text-right text-[var(--c-text-50)] font-medium">Продажа</th>
                </tr>
              </thead>
              <tbody>
                {archiveTablePage.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[var(--c-text-50)]">Архив пуст</td>
                  </tr>
                ) : (
                  archiveTablePage.map((o) => {
                    const item = o.items[0];
                    const product = item?.product;
                    const imei = item?.selected_attributes && "imei" in item.selected_attributes
                      ? String(item.selected_attributes.imei)
                      : "";
                    return (
                      <tr key={o.id} className="border-b border-[var(--c-border)] last:border-0 hover:bg-[var(--c-surface)]">
                        <td className="px-3 py-2 text-[var(--c-text-70)]">{formatDate(orderDate(o))}</td>
                        <td className="px-3 py-2 text-[var(--c-text)]">{o.customer_name || "—"}</td>
                        <td className="px-3 py-2 text-[var(--c-text-70)]">{o.phone || "—"}</td>
                        <td className="px-3 py-2 text-[var(--c-text-70)]">{o.user_username || "—"}</td>
                        <td className="px-3 py-2 text-[var(--c-text-70)]">{o.user_email || "—"}</td>
                        <td className="px-3 py-2 text-[var(--c-text)] font-medium">{product?.name || `Товар #${item?.product_id}`}</td>
                        <td className="px-3 py-2 text-[var(--c-text-70)] font-mono text-xs">{imei || "—"}</td>
                        <td className="px-3 py-2 text-right text-[var(--c-text-50)]">{item?.purchase_price != null ? formatPrice(item.purchase_price) : "—"}</td>
                        <td className="px-3 py-2 text-right text-[var(--c-text)] font-medium">{item?.price_at_purchase != null ? formatPrice(item.price_at_purchase) : formatPrice(o.total_price)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {archiveTablePages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--c-border)] px-4 py-3">
              <span className="text-xs text-[var(--c-text-50)]">
                {archivePage * ARCHIVE_PAGE_SIZE + 1}–{Math.min((archivePage + 1) * ARCHIVE_PAGE_SIZE, visibleOrders.length)} из {visibleOrders.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setArchivePage((p) => Math.max(0, p - 1))}
                  disabled={archivePage === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: archiveTablePages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setArchivePage(i)}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition ${
                      archivePage === i
                        ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                        : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setArchivePage((p) => Math.min(archiveTablePages - 1, p + 1))}
                  disabled={archivePage >= archiveTablePages - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        </>
      ) : activeSubTab === "archive" && archiveView === "stats" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "Заказов", value: String(archiveStats.total), chart: archiveStats.chartOrders, color: "#fbbf24", isPrice: false },
            { label: "Выручка", value: formatPrice(archiveStats.totalRevenue), chart: archiveStats.chartRevenue, color: "#4ade80", isPrice: true },
            { label: "Закупка", value: formatPrice(archiveStats.totalPurchase), chart: archiveStats.chartPurchase, color: "#60a5fa", isPrice: true },
            { label: "Прибыль", value: formatPrice(archiveStats.profit), chart: archiveStats.chartProfit, color: archiveStats.profit >= 0 ? "#4ade80" : "#f87171", isPrice: true },
            { label: "Средний чек", value: formatPrice(archiveStats.avgOrder), chart: archiveStats.chartAvg, color: "#c084fc", isPrice: true },
            { label: "Trade-In", value: String(archiveStats.tradeInCount), chart: archiveStats.chartTradeIn, color: "#fb923c", isPrice: false },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
              <p className="text-xs text-[var(--c-text-50)] mb-1">{s.label}</p>
              <p className="text-lg font-semibold text-[var(--c-text)]">{s.value}</p>
              {s.chart.length > 0 && <MiniChart data={s.chart} labels={archiveStats.dayLabels} color={s.color} isPrice={s.isPrice} />}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.length === 0 ? (
            <p className="text-sm text-[var(--c-text-50)] text-center py-8">
              {activeSubTab === "list" && "Заказы не найдены"}
              {activeSubTab === "delivery" && "Нет заказов в доставке"}
              {activeSubTab === "archive" && "Архив пуст"}
            </p>
          ) : (
            visibleOrders.map((order) => renderOrderCard(order))
          )}
        </div>
      )}

      {photoViewerUrl && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90" onClick={() => setPhotoViewerUrl(null)}>
          <button
            onClick={() => setPhotoViewerUrl(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white text-lg transition hover:bg-white/20"
          >
            ✕
          </button>
          {photoViewerPhotos.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
              {photoViewerIdx + 1} / {photoViewerPhotos.length}
            </div>
          )}
          <img
            src={photoViewerUrl}
            alt=""
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {photoViewerPhotos.length > 1 && (
            <div className="absolute bottom-6 flex gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); setPhotoViewerIdx((i) => { const n = i > 0 ? i - 1 : photoViewerPhotos.length - 1; setPhotoViewerUrl(photoViewerPhotos[n]); return n; }); }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPhotoViewerIdx((i) => { const n = i < photoViewerPhotos.length - 1 ? i + 1 : 0; setPhotoViewerUrl(photoViewerPhotos[n]); return n; }); }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>
          )}
        </div>
      )}

      {archiveConfirmId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c-overlay)]" onClick={() => setArchiveConfirmId(null)}>
          <div className="mx-4 w-full max-w-xs rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[var(--c-text)]">Перенести заказ #{archiveConfirmId} в архив?</p>
            <p className="mt-1 text-xs text-[var(--c-text-50)]">Он исчезнет из активных доставок, но останется в истории</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setArchiveConfirmId(null)}
                className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] py-2 text-xs font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
              <button
                onClick={() => { moveToArchive(archiveConfirmId); setArchiveConfirmId(null); setFabOpenId(null); }}
                className="flex-1 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] py-2 text-xs font-medium text-[var(--c-accent-soft)] transition hover:opacity-80"
              >
                В архив
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--c-overlay)]" onClick={() => setDeleteConfirmId(null)}>
          <div className="mx-4 w-full max-w-xs rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[var(--c-text)]">Удалить заказ #{deleteConfirmId}?</p>
            <p className="mt-1 text-xs text-[var(--c-text-50)]">Действие нельзя отменить</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] py-2 text-xs font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
              <button
                onClick={() => { handleDeleteOrder(deleteConfirmId); setDeleteConfirmId(null); setFabOpenId(null); }}
                className="flex-1 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] py-2 text-xs font-medium text-[var(--c-danger)] transition hover:opacity-80"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {showReassignConfirm !== null && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60" onClick={() => setShowReassignConfirm(null)}>
          <div className="mx-4 w-full max-w-xs rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[var(--c-text)] mb-1">Заменить курьера</h3>
            <p className="text-xs text-[var(--c-text-60)] mb-4">Вы точно хотите поменять доставщика?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowReassignConfirm(null)}
                className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] py-2 text-xs font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
              >Отмена</button>
              <button onClick={async () => { await loadCouriers(); const o = orders.find(o => o.id === showReassignConfirm); setSelectedCourierId(o?.courier_id ?? null); setDeliveryConfirmId(showReassignConfirm); setShowReassignConfirm(null); }}
                className="flex-1 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] py-2 text-xs font-medium text-[var(--c-accent-soft)] transition hover:opacity-80"
              >Да, заменить</button>
            </div>
          </div>
        </div>
      )}

      {deliveryConfirmId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => { if (!addingCourier) setDeliveryConfirmId(null); }}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--c-text)]">Назначить курьера на заказ #{deliveryConfirmId}</h3>
              <button onClick={() => setDeliveryConfirmId(null)} className="text-[var(--c-text-40)] hover:text-[var(--c-text-70)]"><X size={16} /></button>
            </div>

            {addingCourier ? (
              <div className="space-y-3">
                <input
                  type="text" value={newCourierName} onChange={(e) => setNewCourierName(e.target.value)}
                  placeholder="ФИО курьера"
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent-border)]"
                  autoFocus
                />
                <PhoneInput value={newCourierPhone} onChange={setNewCourierPhone} />
                <div className="flex gap-2">
                  <button onClick={() => { setAddingCourier(false); setNewCourierName(""); setNewCourierPhone(""); }}
                    className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] py-2 text-xs font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
                  >Отмена</button>
                  <button onClick={handleCreateCourier}
                    className="flex-1 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] py-2 text-xs font-medium text-[var(--c-accent-soft)] transition hover:opacity-80"
                  >Создать</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {couriers.length === 0 ? (
                  <p className="text-xs text-[var(--c-text-50)] text-center py-4">Нет курьеров. Добавьте нового.</p>
                ) : (
                  couriers.map((c) => (
                    editingCourierId === c.id ? (
                      <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-surface)] p-3">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text" value={editingCourierName} onChange={(e) => setEditingCourierName(e.target.value)}
                            className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent-border)]"
                            autoFocus
                          />
                          <PhoneInput value={editingCourierPhone} onChange={setEditingCourierPhone} />
                          <div className="flex gap-2">
                            <button onClick={() => setEditingCourierId(null)}
                              className="flex-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] py-1 text-[10px] font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
                            >Отмена</button>
                            <button onClick={() => handleSaveCourierEdit(c.id)}
                              className="flex-1 rounded-lg border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] py-1 text-[10px] font-medium text-[var(--c-accent-soft)] transition hover:opacity-80"
                            >Сохранить</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label key={c.id} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition ${
                        selectedCourierId === c.id
                          ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)]"
                          : "border-[var(--c-border)] bg-[var(--c-surface)] hover:bg-[var(--c-surface-hover)]"
                      }`}>
                        <input
                          type="radio" name="courier" checked={selectedCourierId === c.id}
                          onChange={() => setSelectedCourierId(c.id)}
                          className="accent-[var(--c-accent)]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--c-text)] truncate">{c.name}</div>
                          {c.phone && <div className="text-xs text-[var(--c-text-50)]">+7 {c.phone}</div>}
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-[var(--c-text-40)] font-mono">{c.login}</span>
                            <button onClick={(e) => { e.preventDefault(); copyToClipboard(c.login, "Логин скопирован"); }} className="text-[var(--c-text-30)] hover:text-[var(--c-text-60)]"><Copy size={9} /></button>
                          </div>
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-[var(--c-surface)] px-1 py-0.5 text-[10px] text-[var(--c-text-50)] font-mono">{c.password || getCourierCreds(c.id)?.password || "—"}</code>
                            <button onClick={(e) => { e.preventDefault(); copyToClipboard(c.password || getCourierCreds(c.id)?.password || "", "Пароль скопирован"); }} className="text-[var(--c-text-30)] hover:text-[var(--c-text-60)]"><Copy size={9} /></button>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); setEditingCourierId(c.id); setEditingCourierName(c.name); setEditingCourierPhone(c.phone || ""); }}
                          className="p-1.5 rounded-full text-[var(--c-text-40)] hover:text-[var(--c-accent)] hover:bg-[var(--c-accent-bg)] transition"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); handleDeleteCourier(c.id); }}
                          className="p-1.5 rounded-full text-[var(--c-text-40)] hover:text-[var(--c-danger)] hover:bg-[var(--c-danger-bg)] transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </label>
                    )
                  ))
                )}
                <button
                  onClick={() => setAddingCourier(true)}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-[var(--c-border)] py-2.5 text-xs font-medium text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)] transition"
                >
                  + Добавить курьера
                </button>
              </div>
            )}

            {!addingCourier && (
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setDeliveryConfirmId(null); }}
                  className="flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] py-2 text-xs font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
                >Отмена</button>
                <button
                  onClick={() => { if (selectedCourierId !== null) handleAssignCourier(deliveryConfirmId, selectedCourierId); }}
                  disabled={selectedCourierId === null || assigning}
                  className="flex-1 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] py-2 text-xs font-medium text-[var(--c-accent-soft)] transition hover:opacity-80 disabled:opacity-40"
                >
                  {assigning ? "Назначение..." : "Назначить и передать"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-4 py-2 text-xs font-medium text-[var(--c-accent-soft)] shadow-lg transition">
          {copyToast}
        </div>
      )}
    </div>
  );
}
