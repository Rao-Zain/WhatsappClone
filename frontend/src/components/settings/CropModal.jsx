import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Check, Minus, Plus, X } from "lucide-react";
import { FONT } from "./constants";
import { cropToDataUrl } from "./cropImage";

const MAX_CIRCLE = 330;

// Maximum zoom, as a multiple of the starting size. Raise it for even more.
const ZOOM_RANGE = 10;
const ZOOM_STEP = 1.25;

const ZOOM_BTN =
  "flex h-[30px] w-full items-center justify-center text-[color:var(--wa-icon)] hover:bg-[var(--wa-hover)]";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Stops the picture from being dragged off-screen. When it is zoomed out smaller
// than the window it stays centered.
function limitCrop(crop, zoom, media, box) {
  const maxX = Math.max(0, (media.width * zoom - box.w) / 2);
  const maxY = Math.max(0, (media.height * zoom - box.h) / 2);
  return { x: clamp(crop.x, -maxX, maxX), y: clamp(crop.y, -maxY, maxY) };
}

export default function CropModal({ src, onCancel, onConfirm, onUploadAnother }) {
  const areaRef = useRef(null);
  const initialised = useRef(false);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState(null); // original image size
  const [pixels, setPixels] = useState(null); // pixel crop on the original image
  const [box, setBox] = useState({ w: 500, h: 366 }); // size of the crop window

  // The crop window now follows the screen: measure it, and re-measure on resize
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;

    const update = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const circle = Math.max(100, Math.min(MAX_CIRCLE, box.w - 32, box.h - 36));

  // Rendered picture size at zoom 1 (objectFit "cover" over the circle)
  const media = useMemo(() => {
    if (!natural) return null;
    const scale = Math.max(circle / natural.w, circle / natural.h);
    return { width: natural.w * scale, height: natural.h * scale };
  }, [natural, circle]);

  // Zoom at which the picture covers the whole window (the starting zoom)
  const coverZoom = media
    ? Math.max(1, box.w / media.width, box.h / media.height)
    : 1;
  // Zoom-out limit: the whole picture fits inside the window
  const minZoom = media
    ? Math.min(1, box.w / media.width, box.h / media.height)
    : 1;
  const maxZoom = coverZoom * ZOOM_RANGE;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Start by covering the window, once the picture and window sizes are known
  useEffect(() => {
    if (!media || initialised.current) return;
    initialised.current = true;
    setZoom(coverZoom);
    setCrop({ x: 0, y: 0 });
  }, [media, coverZoom]);

  // Pulls the picture back if a change (drag, zoom, resize) left a gap
  useLayoutEffect(() => {
    if (!media) return;
    setCrop((c) => {
      const next = limitCrop(c, zoom, media, box);
      return next.x === c.x && next.y === c.y ? c : next;
    });
  }, [crop, zoom, media, box]);

  const zoomBy = (factor) => setZoom((z) => clamp(z * factor, minZoom, maxZoom));

  const save = async () => {
    if (pixels) onConfirm(await cropToDataUrl(src, pixels));
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adjust profile photo"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[var(--wa-overlay)] p-3 ${FONT}`}
    >
      <div className="wa-shadow-modal relative flex h-[min(500px,calc(100dvh-24px))] w-[min(500px,calc(100vw-24px))] shrink-0 flex-col overflow-hidden rounded-2xl bg-[var(--wa-modal-bg)] text-[color:var(--wa-text-primary)]">
        <div className="flex h-11 shrink-0 items-center pl-[18px] pr-5">
          <button type="button" onClick={onCancel} aria-label="Close" className="flex h-6 w-6 items-center justify-center">
            <X size={24} strokeWidth={2} />
          </button>
          <span className="ml-3 min-w-0 flex-1 truncate text-base leading-6">Drag the image to adjust</span>
          <button type="button" onClick={onUploadAnother} className="text-sm font-medium hover:text-[color:var(--wa-accent)]">
            Upload
          </button>
        </div>

        <div ref={areaRef} className="relative min-h-0 flex-1 bg-[var(--wa-modal-bg)]">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            minZoom={minZoom}
            maxZoom={maxZoom}
            aspect={1}
            cropShape="round"
            cropSize={{ width: circle, height: circle }}
            objectFit="cover"
            showGrid={false}
            restrictPosition={false}
            zoomSpeed={2}
            onCropChange={setCrop}
            onZoomChange={(z) => setZoom(clamp(z, minZoom, maxZoom))}
            onMediaLoaded={(m) => setNatural({ w: m.naturalWidth, h: m.naturalHeight })}
            onCropComplete={(_, areaPixels) => setPixels(areaPixels)}
            style={{ containerStyle: { background: "var(--wa-modal-bg)" } }}
          />

          <div className="wa-shadow-float absolute right-2 top-1/2 z-10 flex w-7 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-[var(--wa-menu-bg)]">
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} className={ZOOM_BTN}>
              <Plus size={18} strokeWidth={2} />
            </button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} className={ZOOM_BTN}>
              <Minus size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Footer keeps the 90px space under the crop window */}
        <div className="h-[90px] shrink-0" />

        <button
          type="button"
          onClick={save}
          aria-label="Save photo"
          className="wa-shadow-float absolute bottom-4 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wa-send-bg)] text-[color:var(--wa-send-fg)] hover:bg-[var(--wa-send-hover)] sm:bottom-16 sm:right-10"
        >
          <Check size={26} strokeWidth={2.2} />
        </button>
      </div>
    </div>,
    document.body
  );
}