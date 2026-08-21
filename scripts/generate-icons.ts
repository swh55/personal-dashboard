// Generate PWA PNG icons from the SVG logo using sharp.
// Run with: bun run scripts/generate-icons.ts

import sharp from "sharp";
import { readFile } from "fs/promises";
import { join } from "path";

async function main() {
  const svgPath = join(process.cwd(), "public", "logo.svg");
  const svgBuffer = await readFile(svgPath);

  const sizes = [192, 512];
  for (const size of sizes) {
    const outPath = join(process.cwd(), "public", `icon-${size}.png`);
    await sharp(svgBuffer, { density: 384 })
      .resize(size, size, { fit: "contain", background: "#0a0e1a" })
      .png()
      .toFile(outPath);
    console.log(`✓ Generated ${outPath} (${size}x${size})`);
  }

  // Also generate a favicon-quality 32x32 maskable icon
  const maskPath = join(process.cwd(), "public", "icon-maskable-512.png");
  await sharp(svgBuffer, { density: 384 })
    .resize(512, 512, {
      fit: "contain",
      background: "#0a0e1a",
    })
    .extend({
      top: 80,
      bottom: 80,
      left: 80,
      right: 80,
      background: "#0a0e1a",
    })
    .png()
    .toFile(maskPath);
  console.log(`✓ Generated ${maskPath} (maskable 512x512)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
