import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";

export default function Brand() {
  const filename = ["seila-logo.svg", "seila-logo.png"].find((name) =>
    existsSync(join(process.cwd(), "public", "images", name)),
  );
  if (!filename) return <span className="brand-wordmark">seila</span>;
  return (
    <Image
      src={`/images/${filename}`}
      alt="Seila"
      width={110}
      height={44}
      unoptimized
      style={{ width: "auto", height: 34, maxWidth: 150, objectFit: "contain" }}
    />
  );
}
