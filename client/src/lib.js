export async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadFile(file) {
  const body = new FormData();
  body.append("file", file);
  const result = await api("/api/upload", { method: "POST", body });
  return result.url;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function drawCover(ctx, image, x, y, w, h) {
  const sr = image.width / image.height;
  const tr = w / h;
  let sx = 0, sy = 0, sw = image.width, sh = image.height;
  if (sr > tr) {
    sw = image.height * tr;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / tr;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

export function drawContain(ctx, image, x, y, w, h, bg = "#fff") {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const sr = image.width / image.height;
  const tr = w / h;
  let dw, dh;
  if (sr > tr) {
    dw = w;
    dh = w / sr;
  } else {
    dh = h;
    dw = h * sr;
  }
  ctx.drawImage(image, x + (w - dw)/2, y + (h - dh)/2, dw, dh);
}
