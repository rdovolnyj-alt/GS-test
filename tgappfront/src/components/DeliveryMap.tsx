import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
};

const MAP_BTN =
  "flex h-9 w-9 items-center justify-center rounded-full border border-black/20 bg-black/70 text-white shadow-lg backdrop-blur-md transition hover:bg-black/80 active:scale-95 disabled:opacity-50";

const GEOCODE_INTERVAL = 1100;

let lastCallTime = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let latestResolve: ((addr: string) => void) | null = null;

function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (latestResolve) {
    latestResolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    latestResolve = null;
  }

  return new Promise<string>((resolve) => {
    latestResolve = resolve;
    const now = Date.now();
    const elapsed = now - lastCallTime;
    const delay = elapsed >= GEOCODE_INTERVAL ? 0 : GEOCODE_INTERVAL - elapsed;

    pendingTimer = setTimeout(async () => {
      pendingTimer = null;
      lastCallTime = Date.now();
      const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ru`,
          { headers: { "User-Agent": "GrandStoreApp/1.0 (delivery-app)" } }
        );
        if (r.status === 429) {
          resolve(fallback);
          return;
        }
        const data = await r.json();
        if (data.address) {
          const a = data.address;
          const road = a.road || a.pedestrian || a.path;
          const house = a.house_number;
          const city = a.city || a.town || a.village;
          const parts: string[] = [];
          if (road) parts.push(road);
          if (house) parts.push(house);
          if (city) parts.push(city);
          if (parts.length > 0) { resolve(parts.join(", ")); return; }
        }
        if (data.display_name) { resolve(data.display_name); return; }
        resolve(fallback);
      } catch {
        resolve(fallback);
      }
    }, delay);
  });
}

export function DeliveryMap({ onLocationSelect, initialLat, initialLng }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const centerLatRef = useRef(initialLat ?? 55.7558);
  const centerLngRef = useRef(initialLng ?? 37.6173);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const startLat = initialLat ?? 55.7558;
    const startLng = initialLng ?? 37.6173;

    const map = L.map(mapRef.current, {
      center: [startLat, startLng],
      zoom: initialLat ? 16 : 12,
      zoomControl: false,
      attributionControl: false,
      keyboard: false,
      crs: L.CRS.EPSG3395,
    });

    const tiles = L.tileLayer("https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=2&lang=ru_RU", {
      maxZoom: 20,
      subdomains: ["01", "02", "03", "04"],
    });
    tiles
      .on("tileerror", () => setTilesFailed(true))
      .on("tileload", () => setTilesFailed(false))
      .addTo(map);

    function geocodeCenter() {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      moveTimerRef.current = setTimeout(() => {
        const lat = centerLatRef.current;
        const lng = centerLngRef.current;
        setLoading(true);
        reverseGeocode(lat, lng).then((display) => {
          setAddress(display);
          setLoading(false);
        });
      }, 800);
    }

    map.on("moveend", () => {
      const c = map.getCenter();
      centerLatRef.current = c.lat;
      centerLngRef.current = c.lng;
      geocodeCenter();
    });

    mapInstanceRef.current = map;

    const invalidate = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    };
    setTimeout(invalidate, 0);
    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);

    setLoading(true);
    reverseGeocode(startLat, startLng).then((display) => {
      setAddress(display);
      setLoading(false);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          map.setView([lat, lng], 16);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    return () => {
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [initialLat, initialLng]);

  function zoomIn() {
    mapInstanceRef.current?.zoomIn();
  }

  function zoomOut() {
    mapInstanceRef.current?.zoomOut();
  }

  function handleConfirm() {
    onLocationSelect(centerLatRef.current, centerLngRef.current, address);
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Map area */}
      <div className="relative mx-3 mb-3 flex-1 min-h-0 overflow-hidden rounded-2xl border border-[var(--c-border)]" style={{ zIndex: 0 }}>
        <div
          ref={mapRef}
          className="absolute inset-0 [&_.leaflet-control-attribution]:hidden [&_.leaflet-control-zoom]:hidden"
        />

        {/* Center pin marker — fixed in viewport center */}
        <div className="pointer-events-none absolute left-1/2 top-[calc(50%-4px)] z-[1000] -translate-x-1/2 -translate-y-full">
          <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 30 18 30s18-17.4 18-30C36 8.06 27.94 0 18 0z" fill="#E53935"/>
            <circle cx="18" cy="18" r="7" fill="white"/>
            <circle cx="18" cy="18" r="3.5" fill="#E53935"/>
          </svg>
        </div>

        {/* Red dot at exact center */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1001] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]" />

        {/* Network warning — shown when tiles fail to load */}
        {tilesFailed && (
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1002]">
            <div className="rounded-xl border border-red-500/40 bg-red-950/90 px-3 py-2 text-center text-[11px] leading-snug text-red-200 shadow-md backdrop-blur-sm">
              Карта не загружается. Проверьте интернет и отключите VPN.
            </div>
          </div>
        )}

        {/* Zoom — right center */}
        <div className="absolute right-3 top-1/2 z-[1000] -translate-y-1/2 flex flex-col gap-1.5">
          <button type="button" onClick={zoomIn} className={MAP_BTN}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button type="button" onClick={zoomOut} className={MAP_BTN}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
        </div>

        {/* Geolocation — right side, above bottom panel */}
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                mapInstanceRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 16);
              },
              () => {},
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
          }}
          className={`absolute bottom-[170px] right-3 z-[1000] ${MAP_BTN}`}
          title="Определить геопозицию"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          </svg>
        </button>
      </div>

      {/* Bottom info panel — floating over the map */}
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-[1000] p-3">
        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-bg)] p-4 shadow-xl">
          <p className="mb-3 text-center text-sm font-semibold text-[var(--c-text-70)]">
            Двигайте карту, чтобы указать место доставки
          </p>

          <div className="mb-3 min-h-[36px] rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5">
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--c-text-40)] border-t-[var(--c-accent)]" />
                <span className="text-xs text-[var(--c-text-40)]">Определение адреса...</span>
              </div>
            ) : address ? (
              <p className="text-xs text-[var(--c-text-70)] leading-relaxed">{address}</p>
            ) : (
              <p className="text-center text-[11px] text-[var(--c-text-40)]">Адрес не определён</p>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={!address || loading}
            className="w-full rounded-2xl bg-[var(--c-accent)] px-4 py-3 text-sm font-semibold text-[var(--c-accent-fg)] transition hover:bg-[var(--c-accent-hover)] disabled:opacity-50"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
