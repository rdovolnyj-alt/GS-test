export interface CourierData {
  orderId: number;
  login: string;
  password: string;
  name: string;
  phone: string;
}

export interface DeliveryProof {
  orderId: number;
  photos: string[];
  imei: string;
  completedAt: string;
}

function generateLogin(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "courier_";
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#";
  let result = "";
  for (let i = 0; i < 10; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function generateCourierCredentials(orderId: number): CourierData {
  return {
    orderId,
    login: generateLogin(),
    password: generatePassword(),
    name: "",
    phone: "",
  };
}

function getCouriersMap(): Record<number, CourierData> {
  try {
    const raw = localStorage.getItem("courier_data");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCouriersMap(data: Record<number, CourierData>) {
  localStorage.setItem("courier_data", JSON.stringify(data));
}

export function saveCourierForOrder(data: CourierData) {
  const map = getCouriersMap();
  map[data.orderId] = data;
  saveCouriersMap(map);
}

export function getCourierForOrder(orderId: number): CourierData | null {
  const map = getCouriersMap();
  return map[orderId] ?? null;
}

export function updateCourierForOrder(orderId: number, patch: Partial<CourierData>) {
  const map = getCouriersMap();
  if (map[orderId]) {
    map[orderId] = { ...map[orderId], ...patch };
    saveCouriersMap(map);
  }
}

function getDeliveryProofsMap(): Record<number, DeliveryProof> {
  try {
    const raw = localStorage.getItem("delivery_proofs");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveDeliveryProofsMap(data: Record<number, DeliveryProof>) {
  localStorage.setItem("delivery_proofs", JSON.stringify(data));
}

export function getDeliveryProof(orderId: number): DeliveryProof | null {
  const map = getDeliveryProofsMap();
  return map[orderId] ?? null;
}

export function saveDeliveryProof(proof: DeliveryProof) {
  const map = getDeliveryProofsMap();
  map[proof.orderId] = proof;
  saveDeliveryProofsMap(map);
}

export function getCourierOrderIds(): number[] {
  try {
    const raw = localStorage.getItem("courier_order_ids");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
