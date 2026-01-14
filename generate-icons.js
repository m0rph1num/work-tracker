const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconDir = "icons";

if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir);
}

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Фон
  ctx.fillStyle = "#6366f1";
  ctx.fillRect(0, 0, size, size);

  // Текст/иконка
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("📊", size / 2, size / 2);

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(iconDir, `icon-${size}x${size}.png`), buffer);
});

console.log("Иконки сгенерированы в папке icons/");
