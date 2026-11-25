"use strict";

const asset = { width: 1080, height: 1920 };
const card = { width: 798, height: 1192 };
const maxBytes = 950_000;
const cardScale = card.width / asset.width;
const visibleHeight = card.height / cardScale;
const cardTop = (asset.height - visibleHeight) / 2;
const fontFamily = '"Noto Template", "PingFang TC", "Microsoft JhengHei", sans-serif';
const demo = {
  brand: "山野日常",
  title: "走進山裡找回慢生活",
  body: "從晨光走到日落，找到你的下一趟山野旅程。",
  cta: "瞭解詳情",
};

const byId = (id) => document.getElementById(id);
const canvas = byId("preview-canvas");
const previewContext = canvas.getContext("2d");
const guide = byId("safe-overlay");
const fields = Object.fromEntries(Object.keys(demo).map((key) => [key, byId(key)]));
const segmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("zh-Hant", { granularity: "grapheme" })
  : null;

const state = {
  image: null,
  logo: "demo",
  zoom: 1,
  x: 0,
  y: 0,
  mode: "card",
};
let redrawPending = false;
let imageRequest = 0;
let logoRequest = 0;
let drag = null;
let fontsReady;

function characters(value) {
  return segmenter ? Array.from(segmenter.segment(value), (item) => item.segment) : Array.from(value);
}

function singleLine(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function ellipsis(context, value, maxWidth) {
  if (context.measureText(value).width <= maxWidth) return value;
  const units = characters(value);
  while (units.length && context.measureText(units.join("").trimEnd() + "…").width > maxWidth) {
    units.pop();
  }
  return units.join("").trimEnd() + "…";
}

function titleLines(context, value, maxWidth) {
  if (context.measureText(value).width <= maxWidth) return [value];
  const pieces = value.match(/[A-Za-z0-9]+(?:[.'-][A-Za-z0-9]+)*|\s+|[^\s]/gu) ?? [];
  const units = pieces.flatMap((piece) => context.measureText(piece).width > maxWidth ? characters(piece) : [piece]);
  let line = "";
  let index = 0;
  for (; index < units.length; index++) {
    if (line && context.measureText(line + units[index]).width > maxWidth) break;
    line += units[index];
  }
  if (/^[，。、！？：；）】」』》]/u.test(units[index] ?? "") && index > 1) {
    index--;
    line = units.slice(0, index).join("");
  }
  return [line.trimEnd(), ellipsis(context, units.slice(index).join("").trimStart(), maxWidth)];
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function photoBounds(image, width, height, zoom, x = 0, y = 0) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  return {
    left: (width - drawnWidth) * (1 - x) / 2,
    top: (height - drawnHeight) * (1 - y) / 2,
    width: drawnWidth,
    height: drawnHeight,
  };
}

function fillPhoto(context, width, height) {
  context.fillStyle = state.image ? "#fff" : "#274136";
  context.fillRect(0, 0, width, height);
  if (!state.image) return;
  const bounds = photoBounds(state.image, asset.width, asset.height, state.zoom, state.x, state.y);
  const scale = width / asset.width;
  const y = (asset.height - height / scale) / 2;
  context.imageSmoothingQuality = "high";
  context.drawImage(state.image, bounds.left * scale, (bounds.top - y) * scale, bounds.width * scale, bounds.height * scale);
}

function roundedFill(context, x, y, width, height, radius, color) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
}

function drawLogo(context, x, y, size) {
  if (!state.logo) return;
  context.save();
  context.translate(x, y);
  context.scale(size / 36, size / 36);
  context.beginPath();
  context.arc(18, 18, 18, 0, 2 * Math.PI);
  context.clip();
  if (state.logo === "demo") {
    context.fillStyle = "#ebefd3";
    context.fillRect(0, 0, 36, 36);
    context.fillStyle = "#244d35";
    context.beginPath();
    context.moveTo(4, 27);
    context.lineTo(14, 12);
    context.lineTo(20, 21);
    context.lineTo(25, 15);
    context.lineTo(34, 27);
    context.closePath();
    context.fill();
  } else {
    const bounds = photoBounds(state.logo, 36, 36, 1);
    context.drawImage(state.logo, bounds.left, bounds.top, bounds.width, bounds.height);
  }
  context.restore();
}

function drawMute(context) {
  const x = 692;
  const y = 1086;
  roundedFill(context, x, y, 70, 70, 35, "#203c3aef");
  context.save();
  context.translate(x, y);
  context.strokeStyle = "white";
  context.lineWidth = 2.6;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(25, 25);
  context.lineTo(18, 25);
  context.lineTo(18, 44);
  context.lineTo(25, 44);
  context.lineTo(38, 54);
  context.lineTo(38, 45);
  context.moveTo(31, 23);
  context.lineTo(38, 16);
  context.lineTo(38, 34);
  context.moveTo(20, 18);
  context.lineTo(54, 52);
  context.stroke();
  context.restore();
}

function drawCard(context, round) {
  const { width, height } = card;
  const mute = byId("mute").checked;
  context.save();
  if (round) {
    context.beginPath();
    context.roundRect(0, 0, width, height, 35);
    context.clip();
  }
  fillPhoto(context, width, height);

  const shade = context.createLinearGradient(0, 660, 0, height);
  shade.addColorStop(0, "transparent");
  shade.addColorStop(.50, "#06100f38");
  shade.addColorStop(1, "#06100f64");
  context.fillStyle = shade;
  context.fillRect(0, 660, width, height - 660);

  const left = 35;
  const textWidth = width - left * 2;
  const brand = singleLine(fields.brand.value);
  const title = singleLine(fields.title.value);
  const body = singleLine(fields.body.value);
  const cta = singleLine(fields.cta.value);
  context.font = `900 44px ${fontFamily}`;
  const lines = titleLines(context, title, textWidth);
  const lineOffset = lines.length === 1 ? 60 : 0;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "white";
  context.strokeStyle = "#ffffffe0";
  context.lineWidth = 1.3;
  context.beginPath();
  context.roundRect(left, 806 + lineOffset, 48, 31, 6);
  context.stroke();
  context.font = `350 18px ${fontFamily}`;
  context.fillText("廣告", left + 6, 828 + lineOffset);

  drawLogo(context, 96, 804 + lineOffset, 36);
  const brandX = state.logo ? 147 : 96;
  context.fillStyle = "white";
  context.font = `400 27px ${fontFamily}`;
  context.fillText(ellipsis(context, brand, width - brandX - left), brandX, 832 + lineOffset);

  context.font = `900 44px ${fontFamily}`;
  for (const [index, line] of lines.entries()) {
    context.fillText(line, left, 909 + lineOffset + 60 * index);
  }
  context.font = `400 31px ${fontFamily}`;
  context.fillText(ellipsis(context, body, textWidth), left, 1038);

  const buttonWidth = mute ? 638 : textWidth;
  roundedFill(context, left, 1086, buttonWidth, 69, 34.5, byId("button-color").value);
  context.font = `750 27px ${fontFamily}`;
  const buttonText = ellipsis(context, cta, buttonWidth - 24);
  context.fillStyle = "white";
  context.textAlign = "center";
  context.fillText(buttonText, left + buttonWidth / 2, 1131);
  if (mute) drawMute(context);
  context.restore();
}

function updateGuide() {
  // The LINE guide centers an 888 × 1152 reference area on the 1080 × 1920 artwork.
  const top = 384;
  const bottom = 1536;
  const height = state.mode === "asset" ? asset.height : visibleHeight;
  const offset = state.mode === "asset" ? 0 : cardTop;
  const horizontal = 96 / asset.width * 100;
  guide.style.setProperty("--guide-inset", `${(top - offset) / height * 100}% ${horizontal}% ${(offset + height - bottom) / height * 100}%`);
  guide.hidden = !byId("show-safe").checked;
}

function requestDraw() {
  if (redrawPending) return;
  redrawPending = true;
  requestAnimationFrame(() => {
    redrawPending = false;
    previewContext.clearRect(0, 0, canvas.width, canvas.height);
    if (state.mode === "card") drawCard(previewContext, true);
    else fillPhoto(previewContext, asset.width, asset.height);
    updateGuide();

    const logoContext = byId("logo-thumb").getContext("2d");
    logoContext.clearRect(0, 0, 24, 24);
    drawLogo(logoContext, 0, 0, 24);
  });
}

function setMode(mode) {
  state.mode = mode;
  const isCard = mode === "card";
  const size = isCard ? card : asset;
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.setAttribute("aria-label", isCard ? "廣告卡片預覽，可用方向鍵移動主圖" : "9:16 主圖預覽，可用方向鍵移動主圖");
  byId("art-frame").dataset.mode = mode;
  byId("card-mode").setAttribute("aria-pressed", String(isCard));
  byId("asset-mode").setAttribute("aria-pressed", String(!isCard));
  requestDraw();
}

function setStatus(text, error = false) {
  const status = byId("status");
  status.dataset.error = String(error);
  status.textContent = text;
}

function resetCrop() {
  state.zoom = 1;
  state.x = 0;
  state.y = 0;
  byId("zoom").value = "100";
  byId("zoom-value").value = "100%";
  requestDraw();
}

async function loadImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

async function handleImage(file, target) {
  if (!file) return;
  const isLogo = target === "logo";
  const request = isLogo ? ++logoRequest : ++imageRequest;
  const isCurrent = () => request === (isLogo ? logoRequest : imageRequest);
  const url = URL.createObjectURL(file);
  try {
    if (!/\.(png|jpe?g|webp)$/iu.test(file.name) && !/^image\/(png|jpeg|webp)$/iu.test(file.type)) {
      throw new Error("unsupported image format");
    }
    const image = await loadImage(url);
    if (!isCurrent()) return;
    state[target] = image;
    if (isLogo) {
      byId("logo-action").textContent = "更換";
      byId("remove-logo").hidden = false;
      setStatus(`已更換 Logo（${file.name}）`);
    } else {
      byId("image-name").textContent = file.name;
      byId("image-name").title = file.name;
      byId("image-meta").textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;
      resetCrop();
      setStatus("已套用主圖");
    }
    requestDraw();
  } catch {
    if (isCurrent()) setStatus("這個檔案無法讀取。請選擇 JPG、PNG 或 WebP 圖片。", true);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setupUpload(fileInput, dropZone, target) {
  fileInput.addEventListener("change", () => {
    const [file] = fileInput.files;
    fileInput.value = "";
    void handleImage(file, target);
  });
  dropZone.addEventListener("dragover", (event) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("is-dragging");
  });
  dropZone.addEventListener("dragleave", (event) => {
    if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("is-dragging");
  });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
    void handleImage(event.dataTransfer.files[0], target);
  });
}

function updateCopy() {
  const notes = [];
  for (const [id, limit, label] of [["title", 10, "標題"], ["body", 25, "內文"]]) {
    const count = Array.from(fields[id].value).length;
    byId(`${id}-count`).value = String(count);
    if (count > limit) notes.push(`${label}超過官方進稿上限 ${limit} 字`);
  }
  if (!/^\p{Script=Han}{4}$/u.test(fields.cta.value)) notes.push("官方進稿的按鈕文字為 4 個中文字");
  if ([fields.title, fields.body].some((field) => /https?:\/\/|www\./i.test(field.value) || /[\r\n]/.test(field.value))) {
    notes.push("進稿文案請移除網址與手動換行");
  }
  const element = byId("copy-notes");
  element.hidden = notes.length === 0;
  element.textContent = notes.length ? notes.join("。") + "。" : "";
  requestDraw();
}

function moveByPixels(dx, dy, frameWidth) {
  if (!state.image) return;
  const bounds = photoBounds(state.image, asset.width, asset.height, state.zoom);
  const pixelRatio = asset.width / frameWidth;
  const availableX = bounds.width - asset.width;
  const availableY = bounds.height - asset.height;
  if (availableX > .01) state.x = clamp(state.x + dx * pixelRatio * 2 / availableX, -1, 1);
  if (availableY > .01) state.y = clamp(state.y + dy * pixelRatio * 2 / availableY, -1, 1);
  requestDraw();
}

canvas.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (drag?.id !== event.pointerId) return;
  moveByPixels(event.clientX - drag.x, event.clientY - drag.y, canvas.clientWidth);
  drag.x = event.clientX;
  drag.y = event.clientY;
});
canvas.addEventListener("lostpointercapture", () => { drag = null; });
canvas.addEventListener("keydown", (event) => {
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const direction = directions[event.key];
  if (!direction) return;
  event.preventDefault();
  const step = event.shiftKey ? 25 : 6;
  moveByPixels(direction[0] * step, direction[1] * step, canvas.clientWidth);
});

function encode(output, format, quality) {
  return new Promise((resolve, reject) => {
    output.toBlob((blob) => {
      if (blob?.type === `image/${format}`) resolve(blob);
      else reject(new Error("無法輸出此格式，請換一種格式重試。"));
    }, `image/${format}`, quality);
  });
}

async function prepareExport(output, format, isPreview) {
  let blob = await encode(output, format, .94);
  if (isPreview || blob.size <= maxBytes) return blob;
  if (format === "png") throw new Error("此 PNG 超過進稿上限 950 KB。請切換成 JPG 後再下載。");
  for (const quality of [.88, .82, .75, .65, .53, .40, .25, .1]) {
    blob = await encode(output, format, quality);
    if (blob.size <= maxBytes) return blob;
  }
  throw new Error("JPG 壓縮後仍超過 950 KB，請換一張圖片。");
}

async function saveImage(isPreview) {
  if (!state.image) {
    setStatus("請先選擇一張主圖。", true);
    return;
  }
  const buttons = [byId("save-image"), byId("save-preview")];
  buttons.forEach((button) => { button.disabled = true; });
  setStatus("正在製作圖片…");
  try {
    const output = document.createElement("canvas");
    const size = isPreview ? card : asset;
    const format = byId("format").value;
    output.width = size.width;
    output.height = size.height;
    const context = output.getContext("2d", { alpha: isPreview && format === "png" });
    if (isPreview) {
      await fontsReady;
      if (format === "jpeg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, size.width, size.height);
      }
      drawCard(context, true);
    } else {
      fillPhoto(context, size.width, size.height);
    }
    const blob = await prepareExport(output, format, isPreview);
    const filename = format === "jpeg" ? "jpg" : "png";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `line-today-${isPreview ? "preview" : "asset"}.${filename}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setStatus(`已下載 ${size.width} × ${size.height} px（${Math.ceil(blob.size / 1000)} KB）`);
  } catch (error) {
    setStatus(error.message || "匯出失敗，請重試。", true);
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function copyText() {
  const text = [
    `廠商名稱：${fields.brand.value}`,
    `標題：${fields.title.value}`,
    `內文：${fields.body.value}`,
    `按鈕：${fields.cta.value}`,
  ].join("\n");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const buffer = document.createElement("textarea");
      buffer.value = text;
      buffer.style.cssText = "position:fixed;left:0;top:0;opacity:0";
      document.body.append(buffer);
      buffer.select();
      const copied = document.execCommand("copy");
      buffer.remove();
      byId("copy-text").focus();
      if (!copied) throw new Error("failed to copy");
    }
    setStatus("已複製文案");
  } catch {
    setStatus("瀏覽器未允許複製，請手動選取欄位中的文字。", true);
  }
}

for (const [key, field] of Object.entries(fields)) {
  field.value = demo[key];
  field.addEventListener("input", updateCopy);
}
setupUpload(byId("image-file"), byId("drop-image"), "image");
setupUpload(byId("logo-file"), byId("drop-logo"), "logo");
byId("remove-logo").addEventListener("click", () => {
  logoRequest++;
  state.logo = null;
  byId("remove-logo").hidden = true;
  byId("logo-action").textContent = "上傳";
  requestDraw();
});
byId("zoom").addEventListener("input", (event) => {
  state.zoom = Number(event.target.value) / 100;
  byId("zoom-value").value = `${event.target.value}%`;
  requestDraw();
});
byId("reset-crop").addEventListener("click", resetCrop);
byId("copy-text").addEventListener("click", copyText);
byId("card-mode").addEventListener("click", () => setMode("card"));
byId("asset-mode").addEventListener("click", () => setMode("asset"));
for (const id of ["show-safe", "mute", "button-color"]) byId(id).addEventListener("input", requestDraw);
byId("save-image").addEventListener("click", () => saveImage(false));
byId("save-preview").addEventListener("click", () => saveImage(true));
fontsReady = document.fonts.load('900 44px "Noto Template"').catch(() => []).then(requestDraw);
loadImage("./assets/demo.jpg").then((image) => {
  if (!state.image) state.image = image;
  requestDraw();
}).catch(() => {
  if (!state.image) setStatus("示範圖片未載入。你仍可上傳自己的主圖。", true);
});
setMode("card");
updateCopy();
