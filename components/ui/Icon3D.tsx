import { ICON3D, type Icon3DName } from "@/lib/icon3d";

interface Icon3DProps {
  name: Icon3DName;
  /** Tile size in px. */
  size?: number;
  round?: boolean;
  className?: string;
}

/** 3D icon on a plain solid-color rounded tile (matches the mobile Icon3D). */
export function Icon3D({ name, size = 36, round, className = "" }: Icon3DProps) {
  const def = ICON3D[name];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: round ? "9999px" : Math.round(size * 0.3),
        backgroundColor: def.color,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={def.src} alt="" width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} className="object-contain" />
    </span>
  );
}
