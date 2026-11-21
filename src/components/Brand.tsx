import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";

export default function Brand() {
  const filename = ["seila-logo.svg", "seila-logo.png"].find((name) =>
    existsSync(join(process.cwd(), "public", "images", name)),
  );
  if (!filename) return <span className="brand-wordmark">seila</span>;
  return (
    <span style={{ display: "block", width: 150, height: 80, overflow: "hidden" }}>
    <Image
      src={`/images/${filename}`}
      alt="Seila"
      width={150}
      height={150}
      unoptimized
      style={{ width: 150, height: 150, transform: "translateY(-35px)", objectFit: "contain" }}
    />
    </span>
  );
}
