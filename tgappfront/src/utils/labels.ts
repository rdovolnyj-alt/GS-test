export const ATTR_LABELS: Record<string, string> = {
  color: "Цвет",
  memory: "ОЗУ",
  country: "Страна",
  storage: "Память",
  processor: "CPU",
  year: "Год",
  type: "Тип",
  connection: "Подключение",
  case_size: "Размер",
  size: "Размер",
  connectivity: "Связь",
  edition: "Версия",
  accessory: "Комплектация",
  clock: "Часы",
  material: "Материал",
  display: "Дисплей",
  part_number: "Код модели",
  cpu_cores: "Ядер CPU",
  gpu_cores: "Ядер GPU",
  band_info: "Ремешок",
  series: "Серия",
  generation: "Поколение",
  case_material: "Материал",
};

export type OrderStatus = "created" | "shipped" | "completed" | "cancelled";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  created: "Новый",
  shipped: "Отправлен",
  completed: "Выполнен",
  cancelled: "Отменён",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  created: "bg-[var(--c-accent-bg)] text-[var(--c-accent-soft)] border-[var(--c-accent-border)]",
  shipped: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  completed: "bg-[var(--c-success-bg)] text-[var(--c-success-soft)] border-[var(--c-success-border)]",
  cancelled: "bg-[var(--c-danger-bg)] text-[var(--c-danger)] border-[var(--c-danger-border)]",
};

export const USER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: "В обработке",
  shipped: "В доставке",
  completed: "Доставлен",
  cancelled: "Отменён",
};
