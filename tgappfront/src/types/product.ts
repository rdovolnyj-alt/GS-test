export type ProductImage = {
  id: number;
  image_url: string;
  is_main: boolean;
};

export type Category = {
  id: number;
  name: string;
  product_count?: number;
};

export type Product = {
  id: string;
  title: string;
  category: string;
  price: number;
  images: string[];
  attributes?: Record<string, string | number>;
};

export type ApiProduct = {
  id: number;
  name: string;
  price: number | null;
  purchase_price: number | null;
  is_available: boolean;
  quantity: number;
  raw_data: string | null;
  category_id: number;
  category: Category | null;
  attributes: Record<string, string | number>;
  images: ProductImage[];
  created_at: string;
  updated_at: string;
};

export type CartItem = Product & { quantity: number };

export type DeliveryData = {
  customerName: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  tradeIn: boolean;
  tradeInDescription: string;
  tradeInPhotos: string[];
  comment: string;
};
