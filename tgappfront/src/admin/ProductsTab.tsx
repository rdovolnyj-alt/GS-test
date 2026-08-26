import { useEffect, useState, useRef, useCallback, Fragment } from "react";
import { Plus, X, Loader2, Paperclip, Pencil, Trash2, FileSpreadsheet, ChevronDown, List, Image, Percent, Tag, Gift, Banknote } from "lucide-react";
import type { ApiProduct, Category } from "../types/product";
import {
  fetchProducts,
  fetchCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  importProductsExcel,
  previewExcelSheets,
  fetchPhotoGroups,
  addPhotoGroupImages,
  removePhotoGroupImage,
  deletePhotoGroup,
  type ExcelSheet,
  type PhotoGroup,
} from "../api/products";
import {
  fetchPromos,
  createPromo,
  updatePromo,
  deletePromo,
  type Promo,
  type PromoInput,
} from "../api/promos";
import {
  fetchMargins,
  createMargin,
  updateMargin,
  deleteMargin,
  type Margin,
} from "../api/margins";
import { uploadFile } from "../utils/upload";
import { ScrollToTopButton } from "../components/ScrollToTopButton";

type AttributeDef = {
  key: string;
  label: string;
  type: "text" | "number";
};

const CATEGORY_ATTRS: Record<string, AttributeDef[]> = {
  iPhone: [
    { key: "memory", label: "Память", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  Телефон: [
    { key: "memory", label: "Память", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  Ноутбук: [
    { key: "year", label: "Год выпуска", type: "number" },
    { key: "processor", label: "Процессор", type: "text" },
    { key: "memory", label: "ОЗУ", type: "text" },
    { key: "storage", label: "Накопитель", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  MacBook: [
    { key: "year", label: "Год выпуска", type: "number" },
    { key: "processor", label: "Процессор", type: "text" },
    { key: "memory", label: "ОЗУ", type: "text" },
    { key: "storage", label: "Накопитель", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  Наушники: [
    { key: "type", label: "Тип", type: "text" },
    { key: "connection", label: "Подключение", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  Часы: [
    { key: "case_size", label: "Размер корпуса", type: "text" },
    { key: "material", label: "Материал", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  Планшет: [
    { key: "display", label: "Дисплей", type: "text" },
    { key: "storage", label: "Накопитель", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  Samsung: [
    { key: "memory", label: "ОЗУ", type: "text" },
    { key: "storage", label: "Накопитель", type: "text" },
    { key: "size", label: "Размер корпуса", type: "text" },
    { key: "connectivity", label: "Связь", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  "Игровые приставки": [
    { key: "storage", label: "Накопитель", type: "text" },
    { key: "edition", label: "Версия", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  Dyson: [
    { key: "color", label: "Цвет", type: "text" },
    { key: "accessory", label: "Комплектация", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  Xiaomi: [
    { key: "memory", label: "ОЗУ", type: "text" },
    { key: "storage", label: "Накопитель", type: "text" },
    { key: "connectivity", label: "Связь", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  POCO: [
    { key: "memory", label: "ОЗУ", type: "text" },
    { key: "storage", label: "Накопитель", type: "text" },
    { key: "connectivity", label: "Связь", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
  "Яндекс Станции": [
    { key: "clock", label: "Часы", type: "text" },
    { key: "color", label: "Цвет", type: "text" },
    { key: "country", label: "Страна", type: "text" },
  ],
};

type FormData = {
  name: string;
  price: string;
  purchase_price: string;
  is_available: boolean;
  quantity: number;
  category_id: number;
  attributes: Record<string, string | number>;
  images: string[];
};

const emptyForm: FormData = {
  name: "",
  price: "",
  purchase_price: "",
  is_available: true,
  quantity: 1,
  category_id: 0,
  attributes: {},
  images: [],
};

type PromoForm = {
  gift_name: string;
  gift_image: string | null;
  gift_price: string;
  target_type: "product" | "category" | "all";
  target_product_id: number | null;
  target_category_id: number | null;
  min_total: string;
  active: boolean;
};

const emptyPromoForm: PromoForm = {
  gift_name: "",
  gift_image: null,
  gift_price: "0",
  target_type: "all",
  target_product_id: null,
  target_category_id: null,
  min_total: "",
  active: true,
};

type ProductsSubTab = "list" | "photos" | "margins" | "promo";

const subTabLabels: Record<ProductsSubTab, string> = {
  list: "Список",
  photos: "Фото",
  margins: "Наценка",
  promo: "Акции",
};

export function ProductsTab() {
  const [activeSubTab, setActiveSubTab] = useState<ProductsSubTab>("list");
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [filterCat, setFilterCat] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ApiProduct | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showChoice, setShowChoice] = useState(false);
  const [importing, setImporting] = useState(false);
  const [excelSheets, setExcelSheets] = useState<ExcelSheet[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [showSheetChoice, setShowSheetChoice] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [photoGroups, setPhotoGroups] = useState<PhotoGroup[]>([]);
  const [photoFilter, setPhotoFilter] = useState("");
  const [photoFilterCat, setPhotoFilterCat] = useState<number[]>([]);
  const [showPhotoFilter, setShowPhotoFilter] = useState(false);
  const [photoGroupTargetId, setPhotoGroupTargetId] = useState<number | null>(null);
  const [photoUploadingGroupId, setPhotoUploadingGroupId] = useState<number | null>(null);
  const [photoDeleting, setPhotoDeleting] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [groupsDeleting, setGroupsDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [successFading, setSuccessFading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);

  const [margins, setMargins] = useState<Margin[]>([]);
  const [marginsLoading, setMarginsLoading] = useState(false);
  const [marginModal, setMarginModal] = useState(false);
  const [marginEditing, setMarginEditing] = useState<Margin | null>(null);
  const [marginForm, setMarginForm] = useState<{ margin_type: "percent" | "fixed"; value: string; target_category_id: number }>({
    margin_type: "percent",
    value: "20",
    target_category_id: 0,
  });
  const [marginSaving, setMarginSaving] = useState(false);
  const [marginDeleting, setMarginDeleting] = useState<number | null>(null);
  const [marginToDelete, setMarginToDelete] = useState<Margin | null>(null);

  const [promos, setPromos] = useState<Promo[]>([]);
  const [promoProducts, setPromoProducts] = useState<ApiProduct[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoModal, setPromoModal] = useState(false);
  const [promoEditing, setPromoEditing] = useState<Promo | null>(null);
  const [promoForm, setPromoForm] = useState<PromoForm>(emptyPromoForm);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoDeleting, setPromoDeleting] = useState<number | null>(null);
  const [promoToDelete, setPromoToDelete] = useState<Promo | null>(null);
  const [promoUploading, setPromoUploading] = useState(false);
  const [promoProductQuery, setPromoProductQuery] = useState("");
  const [promoProductOpen, setPromoProductOpen] = useState(false);
  const promoPhotoInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 50;
  const [currentOffset, setCurrentOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, c] = await Promise.all([
        fetchProducts({ category_ids: filterCat.length > 0 ? filterCat.join(",") : undefined, offset: currentOffset, limit: PAGE_SIZE }),
        fetchCategories(),
      ]);
      setProducts(res.items);
      setTotalCount(res.total);
      setCategories(c);
      setCurrentOffset(0);
    } catch {
      setProducts([]);
      setTotalCount(0);
      setCategories([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterCat, currentOffset]);

  async function reload() {
    try {
      const [res, c] = await Promise.all([
        fetchProducts({ category_ids: filterCat.length > 0 ? filterCat.join(",") : undefined, offset: 0, limit: Math.max(PAGE_SIZE, products.length) }),
        fetchCategories(),
      ]);
      setProducts(res.items);
      setTotalCount(res.total);
      setCategories(c);
    } catch {
      // ignore
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetchProducts({ category_ids: filterCat.length > 0 ? filterCat.join(",") : undefined, offset: products.length, limit: PAGE_SIZE });
      setProducts((prev) => [...prev, ...res.items]);
      setTotalCount(res.total);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  function showToast(msg: string) {
    setSuccessMsg(msg);
    setSuccessFading(false);
    setTimeout(() => setSuccessFading(true), 2500);
  }

  async function loadPhotoGroups() {
    try {
      setPhotoGroups(await fetchPhotoGroups());
    } catch {
      setPhotoGroups([]);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadPhotoGroups();
    })();
  }, []);

  useEffect(() => {
    if (activeSubTab === "photos") {
      void (async () => {
        await loadPhotoGroups();
      })();
    }
  }, [activeSubTab]);

  async function loadPromos() {
    setPromoLoading(true);
    try {
      setPromos(await fetchPromos());
    } catch {
      setPromos([]);
    } finally {
      setPromoLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadPromos();
    })();
  }, []);

  useEffect(() => {
    if (activeSubTab === "promo") {
      void (async () => {
        await loadPromos();
      })();
      if (promoProducts.length === 0) {
        void (async () => {
          await loadAllPromoProducts();
        })();
      }
    }
  }, [activeSubTab, promoProducts.length]);

  async function loadAllPromoProducts() {
    try {
      const all: ApiProduct[] = [];
      const page = 500;
      let offset = 0;
      for (;;) {
        const res = await fetchProducts({ offset, limit: page });
        all.push(...res.items);
        if (all.length >= res.total || res.items.length === 0) break;
        offset += page;
      }
      setPromoProducts(all);
    } catch {
      setPromoProducts([]);
    }
  }

  function openPromoAdd() {
    setPromoEditing(null);
    setPromoForm(emptyPromoForm);
    setPromoProductQuery("");
    setPromoModal(true);
    if (promoProducts.length === 0) loadAllPromoProducts();
  }

  function openPromoEdit(p: Promo) {
    setPromoEditing(p);
    setPromoForm({
      gift_name: p.gift_name,
      gift_image: p.gift_image,
      gift_price: String(p.gift_price ?? 0),
      target_type: p.target_type,
      target_product_id: p.target_product_id,
      target_category_id: p.target_category_id,
      min_total: p.min_total != null ? String(p.min_total) : "",
      active: p.active,
    });
    setPromoProductQuery(p.target_product_name || "");
    setPromoModal(true);
  }

  async function handlePromoPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPromoUploading(true);
    try {
      const url = await uploadFile(files[0]);
      if (url) setPromoForm((f) => ({ ...f, gift_image: url }));
    } catch (err) {
      showToast("Ошибка загрузки фото: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setPromoUploading(false);
      if (promoPhotoInputRef.current) promoPhotoInputRef.current.value = "";
    }
  }

  async function handleSavePromo() {
    if (!promoForm.gift_name.trim()) {
      showToast("Укажите название подарка");
      return;
    }
    if (promoForm.target_type === "product" && !promoForm.target_product_id) {
      showToast("Выберите товар для акции");
      return;
    }
    if (promoForm.target_type === "category" && !promoForm.target_category_id) {
      showToast("Выберите категорию для акции");
      return;
    }
    setPromoSaving(true);
    try {
      const payload: PromoInput = {
        gift_name: promoForm.gift_name.trim(),
        gift_image: promoForm.gift_image || null,
        gift_price: Number(promoForm.gift_price) || 0,
        target_type: promoForm.target_type,
        target_product_id: promoForm.target_product_id,
        target_category_id: promoForm.target_category_id,
        min_total: promoForm.min_total ? Number(promoForm.min_total) : null,
        active: promoForm.active,
      };
      if (promoEditing) {
        await updatePromo(promoEditing.id, payload);
        showToast("Акция обновлена");
      } else {
        await createPromo(payload);
        showToast("Акция добавлена");
      }
      setPromoModal(false);
      await loadPromos();
    } catch (err) {
      showToast("Ошибка сохранения: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setPromoSaving(false);
    }
  }

  async function handleDeletePromo(p: Promo) {
    setPromoToDelete(p);
  }

  async function confirmDeletePromo() {
    if (!promoToDelete) return;
    setPromoDeleting(promoToDelete.id);
    try {
      await deletePromo(promoToDelete.id);
      await loadPromos();
      showToast("Акция удалена");
      setPromoToDelete(null);
    } catch (err) {
      showToast("Ошибка удаления: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setPromoDeleting(null);
    }
  }

  async function handleTogglePromo(p: Promo) {
    try {
      await updatePromo(p.id, { active: !p.active });
      await loadPromos();
    } catch (err) {
      showToast("Ошибка: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    }
  }

  const promoFilteredProducts = promoProducts.filter((x) =>
    x.name.toLowerCase().includes(promoProductQuery.toLowerCase())
  ).slice(0, 50);

  async function loadMargins() {
    setMarginsLoading(true);
    try {
      setMargins(await fetchMargins());
    } catch {
      setMargins([]);
    } finally {
      setMarginsLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadMargins();
    })();
  }, []);

  useEffect(() => {
    if (activeSubTab === "margins") {
      void (async () => {
        await loadMargins();
      })();
    }
  }, [activeSubTab]);

  function fmtMarginValue(m: Pick<Margin, "margin_type" | "value">) {
    return m.margin_type === "percent"
      ? `+${Number(m.value)}%`
      : `+${Number(m.value).toLocaleString("ru-RU")} ₽`;
  }

  function openMarginAdd() {
    setMarginEditing(null);
    setMarginForm({
      margin_type: "percent",
      value: "20",
      target_category_id: categories[0]?.id || 0,
    });
    setMarginModal(true);
  }

  function openMarginEdit(m: Margin) {
    setMarginEditing(m);
    setMarginForm({
      margin_type: m.margin_type,
      value: String(m.value),
      target_category_id: m.target_category_id,
    });
    setMarginModal(true);
  }

  async function handleSaveMargin() {
    if (!marginForm.target_category_id) {
      showToast("Выберите категорию");
      return;
    }
    const val = parseFloat(marginForm.value.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      showToast("Введите значение наценки больше нуля");
      return;
    }
    if (
      !marginEditing &&
      margins.some((m) => m.target_category_id === marginForm.target_category_id)
    ) {
      showToast("Для этой категории уже есть наценка — отредактируйте её");
      return;
    }
    setMarginSaving(true);
    try {
      const payload = {
        margin_type: marginForm.margin_type,
        value: val,
        target_category_id: marginForm.target_category_id,
      };
      const res = marginEditing
        ? await updateMargin(marginEditing.id, payload)
        : await createMargin(payload);
      setMarginModal(false);
      await loadMargins();
      const stats = (res as { applied?: { updated: number; skipped_no_cost: number } }).applied;
      let msg = marginEditing ? "Наценка обновлена" : "Наценка добавлена";
      if (stats) {
        if (stats.updated > 0) msg += `, цен обновлено: ${stats.updated}`;
        if (stats.skipped_no_cost > 0) msg += `, без закупки пропущено: ${stats.skipped_no_cost}`;
      }
      showToast(msg);
    } catch (err) {
      showToast("Ошибка сохранения: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setMarginSaving(false);
    }
  }

  async function handleToggleMargin(m: Margin) {
    try {
      await updateMargin(m.id, { active: !m.active });
      await loadMargins();
    } catch (err) {
      showToast("Ошибка: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    }
  }

  async function confirmDeleteMargin() {
    if (!marginToDelete) return;
    setMarginDeleting(marginToDelete.id);
    try {
      await deleteMargin(marginToDelete.id);
      await loadMargins();
      showToast("Наценка удалена, цены пересчитаны");
      setMarginToDelete(null);
    } catch (err) {
      showToast("Ошибка удаления: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setMarginDeleting(null);
    }
  }


  async function handleGroupPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const groupId = photoGroupTargetId;
    if (groupId == null) return;
    setPhotoUploadingGroupId(groupId);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        const url = await uploadFile(f);
        if (url) urls.push(url);
      }
      if (urls.length > 0) {
        await addPhotoGroupImages(groupId, urls);
        await loadPhotoGroups();
        reload();
        showToast(`Добавлено фото: ${urls.length}`);
      }
    } catch (err) {
      showToast("Ошибка загрузки фото: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setPhotoUploadingGroupId(null);
      setPhotoGroupTargetId(null);
      if (groupPhotoInputRef.current) groupPhotoInputRef.current.value = "";
    }
  }

  async function handleRemoveGroupPhoto(groupId: number, url: string) {
    setPhotoDeleting(url);
    try {
      await removePhotoGroupImage(groupId, url);
      await loadPhotoGroups();
      reload();
      showToast("Фото удалено");
    } catch (err) {
      showToast("Ошибка удаления фото: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setPhotoDeleting(null);
    }
  }

  async function handleBulkDeleteGroups() {
    const ids = [...selectedGroupIds];
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "группу" : ids.length < 5 ? "группы" : "групп";
    if (!confirm(`Точно удалить ${ids.length} ${label} фото? Фото будут отвязаны от всех товаров этих групп. Это действие нельзя отменить.`)) return;
    setGroupsDeleting(true);
    try {
      await Promise.all(ids.map((id) => deletePhotoGroup(id)));
      setSelectedGroupIds([]);
      await loadPhotoGroups();
      reload();
      showToast(`Фото-группы удалены (${ids.length})`);
    } catch (err) {
      showToast("Ошибка удаления: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
    } finally {
      setGroupsDeleting(false);
    }
  }

  const filteredPhotoGroups = photoGroups.filter((g) => {
    const q = photoFilter.trim().toLowerCase();
    const nameOk = !q
      || g.name.toLowerCase().includes(q)
      || g.color.toLowerCase().includes(q);
    const catOk = photoFilterCat.length === 0
      || (g.category_ids || []).some((cid) => photoFilterCat.includes(cid));
    return nameOk && catOk;
  });

  function openAdd() {
    setEditing(null);
    setForm({
      ...emptyForm,
      category_id: categories[0]?.id || 0,
    });
    setShowModal(true);
  }

  function openEdit(p: ApiProduct) {
    setEditing(p);
    setForm({
      name: p.name,
      price: p.price != null && p.price > 0 ? String(p.price) : "",
      purchase_price: p.purchase_price != null ? String(p.purchase_price) : "",
      is_available: p.is_available,
      quantity: p.quantity ?? 1,
      category_id: p.category_id,
      attributes: { ...p.attributes },
      images: p.images.map((i) => i.image_url),
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.category_id) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name,
      price: form.price ? Number(form.price) : null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      is_available: form.is_available,
      quantity: form.quantity,
      category_id: form.category_id,
      attributes: form.attributes,
      images: form.images.map((url, i) => ({
        image_url: url.trim(),
        is_main: i === 0,
      })),
    };

    if (editing) {
      await updateProduct(editing.id, payload);
      setSuccessMsg("Изменения успешно сохранены");
    } else {
      await createProduct(payload as Parameters<typeof createProduct>[0]);
      setSuccessMsg("Товар успешно создан");
    }

    setSuccessFading(false);
    setTimeout(() => setSuccessFading(true), 2500);
    setShowModal(false);
    reload();
    setSaving(false);
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (!confirm(`Точно удалить ${ids.length} товар${ids.length > 1 ? "а" : ""}?`)) return;
    setDeletingId(ids[0]);
    try {
      await Promise.all(ids.map((id) => deleteProduct(id)));
      setSelectedIds([]);
      reload();
      setSuccessMsg(`Записи успешно удалены (${ids.length})`);
      setSuccessFading(false);
      setTimeout(() => setSuccessFading(true), 2500);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      if (url) setForm({ ...form, images: [...form.images, url] });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    setForm({ ...form, images: form.images.filter((_, i) => i !== index) });
  }

  const selectedCatName = categories.find((c) => c.id === form.category_id)?.name || "";
  const attrDefs = CATEGORY_ATTRS[selectedCatName] || [];
  const hasFloatingPanel =
    (activeSubTab === "list" && selectedIds.length > 0) ||
    (activeSubTab === "photos" && selectedGroupIds.length > 0);

  return (
    <div>
      {/* Subtabs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {(["list", "photos", "margins", "promo"] as ProductsSubTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`flex h-9 items-center rounded-xl border px-2.5 text-xs font-medium transition active:scale-95 ${
                activeSubTab === tab
                  ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                  : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"
              }`}
            >
              <span className={`inline-flex transition-all duration-300 ${activeSubTab === tab ? "mr-1.5" : ""}`}>
                {tab === "list" && <List size={14} />}
                {tab === "photos" && <Image size={14} />}
                {tab === "margins" && <Percent size={14} />}
                {tab === "promo" && <Gift size={14} />}
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
                <span className="ml-1.5 rounded-full bg-[var(--c-text-40)]/20 px-1.5 py-0.5 text-[10px]">
                  {tab === "list" ? totalCount : tab === "photos" ? photoGroups.length : tab === "margins" ? margins.length : promos.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeSubTab === "list" && (
        <>
      {/* Toolbar */}
      <div className="mb-3 rounded-2xl border border-[var(--c-border-watermark)] bg-[var(--c-surface-alt)] p-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex h-9 items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base text-[var(--c-text)] outline-none"
            >
              {filterCat.length === 0
                ? "Все категории"
                : `Категории (${filterCat.length})`}
              <ChevronDown size={16} className={`transition-transform ${showFilter ? "rotate-180" : ""}`} />
            </button>
            {showFilter && (
              <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-xl border border-[var(--c-border)] bg-[var(--c-bg)] p-2 shadow-xl max-h-60 overflow-y-scroll">
                {categories.filter(c => c.product_count && c.product_count > 0).map((c) => {
                  const checked = filterCat.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-[var(--c-surface-alt)]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setFilterCat(prev =>
                            checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                          );
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[var(--c-text)]">{c.name} ({c.product_count})</span>
                    </label>
                  );
                })}
                {filterCat.length > 0 && (
                  <button
                    onClick={() => { setFilterCat([]); setShowFilter(false); }}
                    className="w-full mt-1 rounded-lg px-2 py-1.5 text-xs text-[var(--c-text-50)] hover:bg-[var(--c-surface-alt)] transition"
                  >
                    Сбросить
                  </button>
                )}
              </div>
            )}
          </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChoice(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)]"
          >
            <Plus size={18} />
          </button>
        </div>
        </div>
      </div>

      {/* Choice: manual or Excel */}
      {showChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6">
            <h3 className="mb-1 text-lg font-semibold">Добавить товары</h3>
            <p className="mb-4 text-sm text-[var(--c-text-50)]">Выберите способ добавления</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowChoice(false); openAdd(); }}
                className="flex items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-left text-base font-medium transition hover:bg-[var(--c-surface-hover)]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]">
                  <Pencil size={18} />
                </div>
                <div>
                  <div className="text-[var(--c-text)]">Вручную</div>
                  <div className="text-xs text-[var(--c-text-50)]">Заполнить все поля самостоятельно</div>
                </div>
              </button>
              <button
                onClick={() => { setShowChoice(false); excelInputRef.current?.click(); }}
                disabled={importing}
                className="flex items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-left text-base font-medium transition hover:bg-[var(--c-surface-hover)] disabled:opacity-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <div className="text-[var(--c-text)]">Через Excel</div>
                  <div className="text-xs text-[var(--c-text-50)]">Импортировать из Excel-файла</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowChoice(false)}
              className="mt-4 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2.5 text-sm text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)]"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setImporting(true);
          try {
            const { sheets } = await previewExcelSheets(file);
            const checkable = sheets.filter(s => s.can_parse);
            setExcelSheets(sheets);
            setSelectedSheets(new Set(checkable.map(s => s.name)));
            setPreviewFile(file);
            setShowSheetChoice(true);
          } catch (err) {
            alert("Ошибка чтения файла: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
          } finally {
            setImporting(false);
            if (excelInputRef.current) excelInputRef.current.value = "";
          }
        }}
      />

      {showSheetChoice && previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] backdrop-blur-sm" onClick={() => setShowSheetChoice(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-semibold">Выберите листы</h3>
            <p className="mb-4 text-sm text-[var(--c-text-50)]">Отметьте листы Excel для импорта</p>
            <div className="mb-3 flex items-center gap-3 px-1">
              <input
                type="checkbox"
                checked={excelSheets.filter(s => s.can_parse).length > 0 && selectedSheets.size === excelSheets.filter(s => s.can_parse).length}
                onChange={() => {
                  const checkable = excelSheets.filter(s => s.can_parse).map(s => s.name);
                  if (selectedSheets.size === checkable.length) {
                    setSelectedSheets(new Set());
                  } else {
                    setSelectedSheets(new Set(checkable));
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-[var(--c-text-50)] uppercase tracking-wide">Выбрать все</span>
            </div>
            <div className="max-h-48 overflow-y-scroll space-y-1 mb-4">
              {excelSheets.map(s => (
                <label key={s.name} className="flex items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-base transition hover:bg-[var(--c-surface-hover)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSheets.has(s.name)}
                    disabled={!s.can_parse}
                    onChange={() => {
                      const next = new Set(selectedSheets);
                      if (next.has(s.name)) next.delete(s.name);
                      else next.add(s.name);
                      setSelectedSheets(next);
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--c-text)] truncate">{s.name}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSheetChoice(false)}
                className="h-9 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 text-sm font-medium text-[var(--c-text)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
              <button
                disabled={importing}
                onClick={async () => {
                  setImporting(true);
                  try {
                    const sheetsArr = Array.from(selectedSheets);
                    const res = await importProductsExcel(previewFile, sheetsArr);
                    load();
                    setShowSheetChoice(false);
                    const parts = res.details.map(d => {
                      const removedPart = d.removed ? `, удалено ${d.removed}` : "";
                      const hiddenPart = d.hidden ? `, скрыто ${d.hidden}` : "";
                      return `${d.category} — ${d.total} шт.${removedPart}${hiddenPart}`;
                    });
                    setSuccessMsg(`Импортировано: ${parts.join(", ")}`);
                    setSuccessFading(false);
                    setTimeout(() => setSuccessFading(true), 2500);
                  } catch (err) {
                    alert("Ошибка импорта: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
                  } finally {
                    setImporting(false);
                  }
                }}
                className="h-9 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-4 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)] disabled:opacity-50"
              >
                Импортировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--c-text-50)]">
          <Loader2 size={24} className="animate-spin mr-2" />
          Загрузка...
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--c-border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-base whitespace-nowrap">
              <thead>
                <tr className="border-b border-[var(--c-border)] bg-[var(--c-surface-alt)]">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[var(--c-accent)] cursor-pointer"
                      checked={products.length > 0 && selectedIds.length === products.length}
                      onChange={() => {
                        if (selectedIds.length === products.length) {
                          setSelectedIds([]);
                        } else {
                          setSelectedIds(products.map((x) => x.id));
                        }
                      }}
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-[var(--c-text-50)] font-medium">Фото</th>
                  <th className="px-3 py-3 text-left text-[var(--c-text-50)] font-medium">Название</th>
                  <th className="px-3 py-3 text-left text-[var(--c-text-50)] font-medium">Категория</th>
                  <th className="px-3 py-3 text-right text-[var(--c-text-50)] font-medium">Цена продажи</th>
                  <th className="px-3 py-3 text-right text-[var(--c-text-50)] font-medium">Закупка</th>
                  <th className="px-3 py-3 text-right text-[var(--c-text-50)] font-medium">Кол-во</th>
                  <th className="px-3 py-3 text-left text-[var(--c-text-50)] font-medium">Характеристики</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-base text-[var(--c-text-50)]">
                      Товары не найдены
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const checked = selectedIds.includes(p.id);
                    const mainImg = (p.images || []).find((i) => i.is_main) || (p.images || [])[0];
                    const catAttrs = CATEGORY_ATTRS[p.category?.name || ""] || [];
                    return (
                      <tr
                        key={p.id}
                        onClick={() => {
                          setSelectedIds((prev) =>
                            checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`border-b border-[var(--c-border)] transition cursor-pointer last:border-0 ${
                          checked ? "bg-[var(--c-accent-bg)]" : "hover:bg-[var(--c-surface)]"
                        }`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-[var(--c-accent)] cursor-pointer"
                            checked={checked}
                            onChange={() => {
                              setSelectedIds((prev) =>
                                checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              );
                            }}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          {mainImg ? (
                            <img
                              src={mainImg.image_url}
                              alt=""
                              className="h-10 w-10 rounded-lg object-cover border border-[var(--c-border)]"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-alt)]" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--c-text)] font-medium">{p.name}</td>
                        <td className="px-3 py-2.5 text-[var(--c-text-70)]">{p.category?.name || "—"}</td>
                        <td className="px-3 py-2.5 text-right text-[var(--c-text)] font-medium">
                          {p.price != null && p.price > 0 ? `${p.price.toLocaleString("ru-RU")} ₽` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[var(--c-text-50)]">
                          {p.purchase_price != null ? `${p.purchase_price.toLocaleString("ru-RU")} ₽` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[var(--c-text)] font-medium">
                          {p.quantity ?? 1}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--c-text-70)] text-xs max-w-[200px] overflow-hidden text-ellipsis">
                          {catAttrs.length > 0
                            ? catAttrs
                                .map((a) => {
                                  const v = p.attributes[a.key];
                                  if (v === undefined || v === null) return null;
                                  return `${a.label}: ${v}`;
                                })
                                .filter(Boolean)
                                .join(", ")
                            : p.attributes && Object.keys(p.attributes).length > 0
                            ? JSON.stringify(p.attributes)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Load more */}
      {!loading && products.length > 0 && products.length < totalCount && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] disabled:opacity-50"
        >
          {loadingMore ? <Loader2 size={18} className="animate-spin" /> : null}
          Показать ещё ({totalCount - products.length})
        </button>
      )}
        </>
      )}

      {activeSubTab === "photos" && (
        <div className="space-y-3">
          {/* Filters: search + categories */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={photoFilter}
              onChange={(e) => setPhotoFilter(e.target.value)}
              placeholder="Поиск по наименованию или цвету..."
              className="w-full max-w-sm rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-[var(--c-accent-border)]"
            />
            <div className="relative">
              <button
                onClick={() => setShowPhotoFilter(!showPhotoFilter)}
                className="flex h-9 items-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base text-[var(--c-text)] outline-none"
              >
                {photoFilterCat.length === 0 ? "Все категории" : `Категории (${photoFilterCat.length})`}
                <ChevronDown size={16} className={`transition-transform ${showPhotoFilter ? "rotate-180" : ""}`} />
              </button>
              {showPhotoFilter && (
                <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-xl border border-[var(--c-border)] bg-[var(--c-bg)] p-2 shadow-xl max-h-60 overflow-y-scroll">
                  {categories.filter(c => c.product_count && c.product_count > 0).map((c) => {
                    const checked = photoFilterCat.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-[var(--c-surface-alt)]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setPhotoFilterCat(prev =>
                              checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-[var(--c-text)]">{c.name} ({c.product_count})</span>
                      </label>
                    );
                  })}
                  {photoFilterCat.length > 0 && (
                    <button
                      onClick={() => { setPhotoFilterCat([]); setShowPhotoFilter(false); }}
                      className="w-full mt-1 rounded-lg px-2 py-1.5 text-xs text-[var(--c-text-50)] hover:bg-[var(--c-surface-alt)] transition"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="text-sm text-[var(--c-text-50)]">
              Групп: {filteredPhotoGroups.length} / {photoGroups.length}
            </span>
          </div>

          <input
            ref={groupPhotoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleGroupPhotoPick}
          />

          {filteredPhotoGroups.length === 0 ? (
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] px-4 py-16 text-center">
              <Image size={32} className="mx-auto mb-3 text-[var(--c-text-40)]" />
              <p className="text-base font-medium text-[var(--c-text-70)]">
                {photoGroups.length === 0 ? "Фото пока не добавлены" : "Ничего не найдено"}
              </p>
              <p className="mt-1 text-sm text-[var(--c-text-50)]">
                Группы формируются из товаров, добавленных из Excel. Фото переживают перезаливку таблицы и удаляются только здесь.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-[var(--c-border)] bg-[var(--c-surface-alt)] text-left text-xs uppercase tracking-wide text-[var(--c-text-50)]">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[var(--c-accent)] cursor-pointer"
                        checked={filteredPhotoGroups.length > 0 && filteredPhotoGroups.every((g) => selectedGroupIds.includes(g.id))}
                        onChange={() => {
                          const allIds = filteredPhotoGroups.map((g) => g.id);
                          const allSelected = allIds.every((id) => selectedGroupIds.includes(id));
                          setSelectedGroupIds(
                            allSelected
                              ? selectedGroupIds.filter((id) => !allIds.includes(id))
                              : Array.from(new Set([...selectedGroupIds, ...allIds]))
                          );
                        }}
                      />
                    </th>
                    <th className="w-[46%] px-4 py-3 font-medium">Группа товаров</th>
                    <th className="w-[18%] px-4 py-3 font-medium">Цвет</th>
                    <th className="w-[26%] px-4 py-3 font-medium">Наличие</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPhotoGroups.map((g) => {
                    const checkedG = selectedGroupIds.includes(g.id);
                    return (
                    <Fragment key={g.id}>
                      <tr
                        onClick={() => {
                          setSelectedGroupIds((prev) =>
                            checkedG ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                          );
                        }}
                        className={`transition cursor-pointer ${
                          checkedG ? "bg-[var(--c-accent-bg)]" : "hover:bg-[var(--c-surface-hover)]"
                        }`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-[var(--c-accent)] cursor-pointer"
                            checked={checkedG}
                            onChange={() => {
                              setSelectedGroupIds((prev) =>
                                checkedG ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                              );
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="truncate font-medium text-[var(--c-text)]" title={g.name}>
                            {g.name}
                          </div>
                          <div className="truncate text-xs text-[var(--c-text-50)]" title={g.categories && g.categories.length > 0 ? g.categories.join(", ") : "Без категории"}>
                            {g.categories && g.categories.length > 0 ? g.categories.join(", ") : "Без категории"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="truncate text-[var(--c-text-70)]" title={g.color}>{g.color || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${g.product_count > 0 ? "bg-green-500" : "bg-red-500"}`} />
                            <span className={`text-xs ${g.product_count > 0 ? "text-green-500" : "text-red-500"}`}>
                              {g.product_count > 0 ? `Есть товар (${g.product_count} шт.)` : `Нет товара (${g.product_count} шт.)`}
                            </span>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-[var(--c-border)] last:border-0">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {g.images.map((url) => (
                              <div key={url} className="relative">
                                <img
                                  src={url}
                                  alt=""
                                  className="h-16 w-16 rounded-lg object-cover border border-[var(--c-border)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGroupPhoto(g.id, url)}
                                  disabled={photoDeleting === url}
                                  className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-red-500 bg-red-500 text-white shadow-md disabled:opacity-40"
                                  title="Удалить фото"
                                >
                                  {photoDeleting === url
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <X size={13} />}
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => { setPhotoGroupTargetId(g.id); groupPhotoInputRef.current?.click(); }}
                              disabled={photoUploadingGroupId !== null}
                              className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-[var(--c-border)] text-[var(--c-text-50)] transition hover:border-[var(--c-accent-border)] hover:text-[var(--c-accent-soft)] disabled:opacity-50"
                              title="Добавить несколько фото"
                            >
                              {photoUploadingGroupId === g.id ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === "margins" && (
        <div>
          <div className="mb-3 rounded-2xl border border-[var(--c-border-watermark)] bg-[var(--c-surface-alt)] p-3 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--c-text-50)]">
                Наценка задаёт цену продажи всех товаров категории от цены закупки — в процентах или фиксированной суммой. Цены пересчитываются автоматически, в том числе после импорта Excel.
              </p>
              <button
                onClick={openMarginAdd}
                className="flex h-9 items-center gap-2 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)]"
              >
                <Plus size={18} />
                Добавить наценку
              </button>
            </div>
          </div>

          {marginsLoading ? (
            <div className="flex items-center justify-center py-16 text-[var(--c-text-50)]">
              <Loader2 size={24} className="animate-spin mr-2" />
              Загрузка...
            </div>
          ) : margins.length === 0 ? (
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] px-4 py-16 text-center">
              <Percent size={32} className="mx-auto mb-3 text-[var(--c-text-40)]" />
              <p className="text-base font-medium text-[var(--c-text-70)]">Наценки пока не заданы</p>
              <p className="mt-1 text-sm text-[var(--c-text-50)]">
                Наценка привязывается к категории и пересчитывает цены продажи от закупки. Категории создаются при импорте Excel и остаются привязанными к наценке при перезаливке прайса.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {margins.map((m) => {
                const catMissing = !categories.some((c) => c.id === m.target_category_id);
                const hasGoods = !catMissing && (m.products_count ?? 0) > 0;
                return (
                <div
                  key={m.id}
                  className={`rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 transition ${m.active ? "" : "opacity-60"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]">
                        {m.margin_type === "percent" ? <Percent size={20} /> : <Banknote size={20} />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--c-text)]">
                          {m.target_category_name || `Категория #${m.target_category_id}`}
                        </div>
                        <div className="truncate text-xs text-[var(--c-text-50)]">
                          Наценка {fmtMarginValue(m)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${hasGoods ? "bg-green-500" : "bg-red-500"}`} />
                          <span className={`text-xs ${hasGoods ? "text-green-500" : "text-red-500"}`}>
                            {catMissing
                              ? "Категории нет"
                              : hasGoods
                              ? `Есть товар (${m.products_count} шт.)`
                              : `Нет товара (${m.products_count ?? 0} шт.)`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleMargin(m)}
                      disabled={marginDeleting === m.id}
                      className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                        m.active ? "bg-[var(--c-accent)]" : "bg-[var(--c-text-40)]/30"
                      }`}
                      title={m.active ? "Выключить" : "Включить"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          m.active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openMarginEdit(m)}
                      className="flex flex-1 h-11 items-center justify-center gap-2 rounded-xl border border-[var(--c-border)] text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]"
                    >
                      <Pencil size={16} />
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarginToDelete(m)}
                      disabled={marginDeleting === m.id}
                      className="flex flex-1 h-11 items-center justify-center gap-2 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] text-sm font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)] disabled:opacity-50"
                    >
                      {marginDeleting === m.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      Удалить
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === "promo" && (
        <div>
          <div className="mb-3 rounded-2xl border border-[var(--c-border-watermark)] bg-[var(--c-surface-alt)] p-3 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--c-text-50)]">
                Подарок автоматически добавляется в заказ при оформлении: для всех товаров, конкретной категории или одного товара, с учётом минимальной суммы корзины.
              </p>
              <button
                onClick={openPromoAdd}
                className="flex h-9 items-center gap-2 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)]"
              >
                <Plus size={18} />
                Добавить акцию
              </button>
            </div>
          </div>

          <input
            ref={promoPhotoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePromoPhotoPick}
          />

          {promoLoading ? (
            <div className="flex items-center justify-center py-16 text-[var(--c-text-50)]">
              <Loader2 size={24} className="animate-spin mr-2" />
              Загрузка...
            </div>
          ) : promos.length === 0 ? (
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] px-4 py-16 text-center">
              <Gift size={32} className="mx-auto mb-3 text-[var(--c-text-40)]" />
              <p className="text-base font-medium text-[var(--c-text-70)]">Акции пока не добавлены</p>
              <p className="mt-1 text-sm text-[var(--c-text-50)]">
                Добавьте первый подарок — он появится в заказе покупателя при оформлении.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {promos.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 transition ${p.active ? "" : "opacity-60"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {p.gift_image ? (
                        <img src={p.gift_image} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-[var(--c-border)] object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-alt)] text-[var(--c-text-40)]">
                          <Tag size={20} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--c-text)]">{p.gift_name}</div>
                        <div className="truncate text-xs text-[var(--c-text-50)]">
                          {p.target_type === "product"
                            ? `Товар: ${p.target_product_name || `#${p.target_product_id}`}`
                            : p.target_type === "category"
                            ? `Категория: ${p.target_category_name || `#${p.target_category_id}`}`
                            : "Все товары"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePromo(p)}
                      disabled={promoDeleting === p.id}
                      className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                        p.active ? "bg-[var(--c-accent)]" : "bg-[var(--c-text-40)]/30"
                      }`}
                      title={p.active ? "Выключить" : "Включить"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          p.active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                    <span className="text-[var(--c-text-70)]">
                      {p.min_total != null ? `от ${p.min_total.toLocaleString("ru-RU")} ₽` : "без условия"}
                    </span>
                    <span className="font-medium text-[var(--c-text)]">
                      {p.gift_price > 0 ? `${p.gift_price.toLocaleString("ru-RU")} ₽` : "Бесплатно"}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openPromoEdit(p)}
                      className="flex flex-1 h-11 items-center justify-center gap-2 rounded-xl border border-[var(--c-border)] text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]"
                    >
                      <Pencil size={16} />
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePromo(p)}
                      disabled={promoDeleting === p.id}
                      className="flex flex-1 h-11 items-center justify-center gap-2 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] text-sm font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)] disabled:opacity-50"
                    >
                      {promoDeleting === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {promoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] backdrop-blur-sm">
              <div className="w-full max-w-xl rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6 sm:rounded-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">{promoEditing ? "Редактировать акцию" : "Новая акция"}</h3>
                  <button onClick={() => setPromoModal(false)} className="rounded-full p-2 text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">Подарок *</label>
                    <input
                      value={promoForm.gift_name}
                      onChange={(e) => setPromoForm({ ...promoForm, gift_name: e.target.value })}
                      placeholder="Например: Чехол в подарок"
                      className="h-11 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base outline-none transition focus:border-[var(--c-accent-border)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">Фото подарка</label>
                    <div className="flex items-center gap-3">
                      {promoForm.gift_image ? (
                        <div className="relative">
                          <img src={promoForm.gift_image} alt="" className="h-16 w-16 rounded-lg object-cover border border-[var(--c-border)]" />
                          <button
                            type="button"
                            onClick={() => setPromoForm({ ...promoForm, gift_image: null })}
                            className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-red-500 bg-red-500 text-white shadow-md"
                            title="Убрать фото"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => promoPhotoInputRef.current?.click()}
                          disabled={promoUploading}
                          className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-[var(--c-border)] text-[var(--c-text-50)] transition hover:border-[var(--c-accent-border)] hover:text-[var(--c-accent-soft)] disabled:opacity-50"
                          title="Загрузить фото"
                        >
                          {promoUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">
                      Цена подарка, ₽ <span className="text-[var(--c-text-50)] font-normal">(0 — бесплатно)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={promoForm.gift_price}
                      onChange={(e) => setPromoForm({ ...promoForm, gift_price: e.target.value })}
                      className="h-11 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base outline-none transition focus:border-[var(--c-accent-border)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">На какие товары действует</label>
                    <select
                      value={promoForm.target_type}
                      onChange={(e) =>
                        setPromoForm({
                          ...promoForm,
                          target_type: e.target.value as PromoForm["target_type"],
                          target_product_id: null,
                          target_category_id: null,
                        })
                      }
                      className="h-11 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base outline-none transition focus:border-[var(--c-accent-border)]"
                    >
                      <option value="all">Все товары</option>
                      <option value="category">Категория</option>
                      <option value="product">Конкретный товар</option>
                    </select>
                  </div>

                  {promoForm.target_type === "category" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">Категория</label>
                      <select
                        value={promoForm.target_category_id ?? ""}
                        onChange={(e) =>
                          setPromoForm({ ...promoForm, target_category_id: e.target.value ? Number(e.target.value) : null })
                        }
                        className="h-11 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base outline-none transition focus:border-[var(--c-accent-border)]"
                      >
                        <option value="">Выберите категорию</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {promoForm.target_type === "product" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">Товар</label>
                      <div className="relative">
                        <input
                          value={promoProductQuery}
                          onChange={(e) => { setPromoProductQuery(e.target.value); setPromoProductOpen(true); }}
                          onFocus={() => setPromoProductOpen(true)}
                          onBlur={() => setTimeout(() => setPromoProductOpen(false), 150)}
                          placeholder="Поиск товара..."
                          className="h-11 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base outline-none transition focus:border-[var(--c-accent-border)]"
                        />
                        {promoProductOpen && promoProductQuery.trim() !== "" && (
                          <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-60 overflow-y-scroll rounded-xl border border-[var(--c-border)] bg-[var(--c-bg)] p-1 shadow-xl">
                            {promoFilteredProducts.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-[var(--c-text-50)]">Ничего не найдено</div>
                            ) : (
                              promoFilteredProducts.map((x) => (
                                <button
                                  key={x.id}
                                  type="button"
                                  onMouseDown={() => {
                                    setPromoForm({ ...promoForm, target_product_id: x.id });
                                    setPromoProductQuery(x.name);
                                    setPromoProductOpen(false);
                                  }}
                                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-[var(--c-text)] transition hover:bg-[var(--c-surface-hover)]"
                                >
                                  {x.name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        {promoForm.target_product_id != null && (
                          <div className="mt-1 text-xs text-[var(--c-accent-soft)]">
                            Выбран: {promoProducts.find((x) => x.id === promoForm.target_product_id)?.name || promoProductQuery}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">
                      Мин. сумма корзины, ₽ <span className="text-[var(--c-text-50)] font-normal">(необязательно)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={promoForm.min_total}
                      onChange={(e) => setPromoForm({ ...promoForm, min_total: e.target.value })}
                      placeholder="Без ограничения"
                      className="h-11 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base outline-none transition focus:border-[var(--c-accent-border)]"
                    />
                  </div>

                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setPromoModal(false)}
                    className="h-10 rounded-xl border border-[var(--c-border)] px-4 text-sm font-medium text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)]"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSavePromo}
                    disabled={promoSaving}
                    className="flex h-10 items-center gap-2 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-4 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)] disabled:opacity-50"
                  >
                    {promoSaving && <Loader2 size={16} className="animate-spin" />}
                    {promoEditing ? "Сохранить" : "Добавить"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {marginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6 sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">{marginEditing ? "Редактировать наценку" : "Новая наценка"}</h3>
              <button onClick={() => setMarginModal(false)} className="rounded-full p-2 text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">Категория *</label>
                <select
                  value={marginForm.target_category_id || ""}
                  onChange={(e) =>
                    setMarginForm({ ...marginForm, target_category_id: e.target.value ? Number(e.target.value) : 0 })
                  }
                  className="h-11 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-base outline-none transition focus:border-[var(--c-accent-border)]"
                >
                  <option value="">{categories.length === 0 ? "Категорий пока нет" : "Выберите категорию"}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="mt-1 text-xs text-[var(--c-danger)]">
                    Категорий ещё нет — они создадутся автоматически при первом импорте Excel.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">Тип наценки</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMarginForm({ ...marginForm, margin_type: "percent" })}
                    className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
                      marginForm.margin_type === "percent"
                        ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                        : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] hover:bg-[var(--c-surface-hover)]"
                    }`}
                  >
                    <Percent size={16} />
                    Процент, %
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarginForm({ ...marginForm, margin_type: "fixed" })}
                    className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
                      marginForm.margin_type === "fixed"
                        ? "border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)]"
                        : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text-70)] hover:bg-[var(--c-surface-hover)]"
                    }`}
                  >
                    <Banknote size={16} />
                    Сумма, ₽
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--c-text-70)]">
                  Наценка{marginForm.margin_type === "percent" ? ", %" : ", ₽"} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={marginForm.value}
                    onChange={(e) => setMarginForm({ ...marginForm, value: e.target.value })}
                    placeholder={marginForm.margin_type === "percent" ? "Например: 20" : "Например: 1000"}
                    className="h-11 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 pr-12 text-base outline-none transition focus:border-[var(--c-accent-border)]"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base text-[var(--c-text-50)]">
                    {marginForm.margin_type === "percent" ? "%" : "₽"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--c-text-50)]">
                  {marginForm.margin_type === "percent"
                    ? "Цена продажи = цена закупки × (1 + наценка / 100)"
                    : "Цена продажи = цена закупки + наценка"}
                </p>
              </div>

              {!marginEditing && margins.length > 0 && (
                <p className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] px-3 py-2 text-xs text-[var(--c-text-50)]">
                  Для одной категории действует одна наценка. Если у категории уже есть правило — отредактируйте его.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setMarginModal(false)}
                className="h-10 rounded-xl border border-[var(--c-border)] px-4 text-sm font-medium text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveMargin}
                disabled={marginSaving || categories.length === 0}
                className="flex h-10 items-center gap-2 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-4 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)] disabled:opacity-50"
              >
                {marginSaving && <Loader2 size={16} className="animate-spin" />}
                {marginEditing ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {marginToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] text-[var(--c-danger)]">
              <Trash2 size={22} />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Удалить наценку?</h3>
            <p className="mt-1 text-sm text-[var(--c-text-50)]">
              Удалить наценку {fmtMarginValue(marginToDelete)} для категории «{marginToDelete.target_category_name || `#${marginToDelete.target_category_id}`}»? Цены товаров категории будут пересчитаны. Это действие нельзя отменить.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setMarginToDelete(null)}
                disabled={marginDeleting === marginToDelete.id}
                className="h-11 flex-1 rounded-xl border border-[var(--c-border)] text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteMargin}
                disabled={marginDeleting === marginToDelete.id}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] text-sm font-medium text-[var(--c-danger)] transition hover:opacity-90 disabled:opacity-50"
              >
                {marginDeleting === marginToDelete.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {promoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] text-[var(--c-danger)]">
              <Trash2 size={22} />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Удалить акцию?</h3>
            <p className="mt-1 text-sm text-[var(--c-text-50)]">
              Точно удалить «{promoToDelete.gift_name}»? Это действие нельзя отменить.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setPromoToDelete(null)}
                disabled={promoDeleting === promoToDelete.id}
                className="h-11 flex-1 rounded-xl border border-[var(--c-border)] text-sm font-medium text-[var(--c-text-70)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
              <button
                onClick={confirmDeletePromo}
                disabled={promoDeleting === promoToDelete.id}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] text-sm font-medium text-[var(--c-danger)] transition hover:opacity-90 disabled:opacity-50"
              >
                {promoDeleting === promoToDelete.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating action panel */}
      {activeSubTab === "list" && selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-7xl px-4 pb-4">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-bg)] px-5 py-4 shadow-2xl backdrop-blur-xl">
            <span className="text-sm text-[var(--c-text-50)]">
              Выбрано: <strong className="text-[var(--c-text)]">{selectedIds.length}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (selectedIds.length === 1) {
                    const p = products.find((x) => x.id === selectedIds[0]);
                    if (p) openEdit(p);
                  } else {
                    alert("Редактировать можно только один товар");
                  }
                }}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--c-accent-border)] bg-[var(--c-accent-bg)] px-3 text-sm font-medium text-[var(--c-accent-soft)] transition hover:bg-[var(--c-accent-border)] sm:px-4"
                title={selectedIds.length === 1 ? "Редактировать товар" : "Редактировать можно только один товар"}
              >
                <Pencil size={18} />
                <span className="hidden sm:inline">Редактировать</span>
              </button>
              <button
                onClick={() => handleBulkDelete()}
                disabled={deletingId !== null}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-3 text-sm font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)] disabled:opacity-50 sm:px-4"
                title="Удалить выбранные товары"
              >
                {deletingId !== null ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                <span className="hidden sm:inline">Удалить</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--c-border)] text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]"
                title="Снять выделение"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "photos" && selectedGroupIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-7xl px-4 pb-4">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--c-accent-border)] bg-[var(--c-bg)] px-5 py-4 shadow-2xl backdrop-blur-xl">
            <span className="text-sm text-[var(--c-text-50)]">
              Выбрано: <strong className="text-[var(--c-text)]">{selectedGroupIds.length}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDeleteGroups}
                disabled={groupsDeleting}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-3 text-sm font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-border)] disabled:opacity-50 sm:px-4"
                title="Удалить выбранные фото-группы"
              >
                {groupsDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                <span className="hidden sm:inline">Удалить</span>
              </button>
              <button
                onClick={() => setSelectedGroupIds([])}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--c-border)] text-[var(--c-text-50)] transition hover:bg-[var(--c-surface-hover)] hover:text-[var(--c-text)]"
                title="Снять выделение"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to top */}
      <ScrollToTopButton raised={hasFloatingPanel} />

      {/* Success notification */}
      {successMsg && (
        <div
          className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-[var(--c-success-border)] bg-[var(--c-success-bg)] px-5 py-3 text-sm text-[var(--c-success)] shadow-2xl backdrop-blur-xl transition-opacity duration-300 ${
            successFading ? "opacity-0" : "opacity-100"
          }`}
          onTransitionEnd={() => { if (successFading) { setSuccessMsg(null); setSuccessFading(false); } }}
        >
          {successMsg}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--c-overlay)] backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-t-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-6 sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                {editing ? "Редактировать товар" : "Добавить товар"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--c-border)] text-[var(--c-text-50)] hover:bg-[var(--c-surface-hover)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[var(--c-text-50)] uppercase tracking-wider">Категория *</label>
                <select
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-base text-[var(--c-text)] outline-none"
                  value={form.category_id}
                  onChange={(e) => {
                    const catId = Number(e.target.value);
                    setForm({ ...form, category_id: catId, attributes: {} });
                  }}
                >
                  <option value={0}>Выберите категорию</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[var(--c-text-50)] uppercase tracking-wider">Название *</label>
                <input
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-base text-[var(--c-text)] outline-none"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[var(--c-text-50)] uppercase tracking-wider">Цена продажи (₽)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-base text-[var(--c-text)] outline-none"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                <p className="mt-1 text-xs text-[var(--c-text-50)]">
                  Если не заполнена, покупателю показывается цена закупки
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[var(--c-text-50)] uppercase tracking-wider">Закупочная цена (₽)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-base text-[var(--c-text)] outline-none"
                  value={form.purchase_price}
                  onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[var(--c-text-50)] uppercase tracking-wider">Количество</label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-base text-[var(--c-text)] outline-none"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>

              {/* Dynamic attributes */}
              {selectedCatName && (
                <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-alt)] p-4">
                  <p className="mb-3 text-xs text-[var(--c-text-50)] uppercase tracking-wider font-medium">
                    Характеристики
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(attrDefs.length > 0 ? attrDefs : Object.keys(form.attributes).map((k) => ({ key: k, label: k, type: "text" as const }))).map((attr) => (
                      <div key={attr.key}>
                        <label className="mb-1 block text-xs text-[var(--c-text-50)]">{attr.label}</label>
                        <input
                          type={attr.type}
                          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-base text-[var(--c-text)] outline-none"
                          value={form.attributes[attr.key] ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              attributes: {
                                ...form.attributes,
                                [attr.key]: attr.type === "number" ? Number(e.target.value) : e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-[var(--c-text-50)] uppercase tracking-wider">
                  Фотографии
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-16 rounded-lg object-cover border border-[var(--c-border)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500 bg-red-500 text-white opacity-40 hover:opacity-100 transition-opacity"
                        title="Удалить фото"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-[var(--c-border)] text-[var(--c-text-50)] transition hover:border-[var(--c-accent-border)] hover:text-[var(--c-accent-soft)] disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-base font-medium text-[var(--c-text-80)] transition hover:bg-[var(--c-surface-hover)]"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.category_id}
                className="flex-1 rounded-2xl bg-[var(--c-accent)] px-4 py-3 font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] disabled:opacity-50"
              >
                {saving ? "Сохранение..." : editing ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
