"use strict";

const asset = { width: 1080, height: 1920 };
const card = { width: 798, height: 1192 };
const screenshot = { width: 869, height: 1884, cardX: 36, cardY: 387 };
const cardRadius = 35;
const cardScale = card.width / asset.width;
const visibleHeight = card.height / cardScale;
const cardTop = (asset.height - visibleHeight) / 2;
let fontFamily = '"PingFang TC", "Microsoft JhengHei", sans-serif';
let clockFontFamily = "sans-serif";
const demo = {
  brand: "山野日常",
  title: "走進山裡找回慢生活",
  body: "從晨光走到日落，找到你的下一趟山野旅程。",
  cta: "瞭解詳情",
};

const byId = (id) => document.getElementById(id);
const canvas = byId("preview-canvas");
const materialType = byId("material-type");
const muteToggle = byId("mute");
const imageFile = byId("image-file");
const removeImageButton = byId("remove-image");
const previewContext = canvas.getContext("2d");
const cardSurface = document.createElement("canvas");
cardSurface.width = card.width;
cardSurface.height = card.height;
const cardContext = cardSurface.getContext("2d", { alpha: false });
const fields = Object.fromEntries(Object.keys(demo).map((key) => [key, byId(key)]));
const cropControls = {
  zoom: { range: byId("zoom"), number: byId("zoom-value") },
  x: { range: byId("position-x"), number: byId("position-x-value") },
  y: { range: byId("position-y"), number: byId("position-y-value") },
};
const screenshotTime = byId("screenshot-time");
const screenshotCategories = [
  byId("screenshot-category-first"),
  byId("screenshot-category-second"),
];
const segmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("zh-Hant", { granularity: "grapheme" })
  : null;

const defaultCrop = { zoom: 100, x: 0, y: 0 };
const state = {
  image: undefined, // The demo may load until the user chooses or clears an image.
  logo: "demo",
  ...defaultCrop,
  mode: "card",
};
let redrawPending = false;
let imageRequest = 0;
let logoRequest = 0;
let drag = null;
let screenshotFrame = null;
let clockFontReady;

function characters(value) {
  return segmenter ? Array.from(segmenter.segment(value), (item) => item.segment) : Array.from(value);
}

function singleLine(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function ellipsis(context, value, maxWidth, suffix = "…") {
  if (context.measureText(value).width <= maxWidth) return value;
  const units = characters(value);
  while (units.length && context.measureText(units.join("").trimEnd() + suffix).width > maxWidth) {
    units.pop();
  }
  return units.join("").trimEnd() + suffix;
}

function titleUnits(context, value, maxWidth) {
  const glyphs = characters(value);
  const boundaries = new Map([[0, 0]]);
  let offset = 0;
  for (const [index, glyph] of glyphs.entries()) {
    offset += glyph.length;
    boundaries.set(offset, index + 1);
  }
  const units = [];
  let next = 0;
  for (const match of value.matchAll(/[A-Za-z0-9]+(?:[.'-][A-Za-z0-9]+)*/g)) {
    const word = match[0];
    const start = boundaries.get(match.index);
    const end = boundaries.get(match.index + word.length);
    if (start === undefined || end === undefined || context.measureText(word).width > maxWidth) continue;
    units.push(...glyphs.slice(next, start), word);
    next = end;
  }
  return units.concat(glyphs.slice(next));
}

function titleLines(context, value, maxWidth) {
  if (context.measureText(value).width <= maxWidth) return [value];
  const units = titleUnits(context, value, maxWidth);
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

function photoBounds(image, width, height, zoom, coverHeight = height) {
  const scale = Math.max(width / image.naturalWidth, coverHeight / image.naturalHeight) * zoom;
  const drawnWidth = image.naturalWidth * scale;
  const drawnHeight = image.naturalHeight * scale;
  return {
    left: (width - drawnWidth) / 2,
    top: (height - drawnHeight) / 2,
    width: drawnWidth,
    height: drawnHeight,
  };
}

function fillPhoto(context) {
  context.fillStyle = state.image ? "#fff" : "#274136";
  context.fillRect(0, 0, card.width, card.height);
  if (!state.image || state.zoom === 0) return;
  // Fit the original 9:16 area at 100%, then position the image in card pixels.
  const bounds = photoBounds(state.image, asset.width, visibleHeight, state.zoom / 100, asset.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(
    state.image,
    bounds.left * cardScale + Math.round(state.x),
    bounds.top * cardScale + Math.round(state.y),
    bounds.width * cardScale, bounds.height * cardScale,
  );
}

function roundedPath(context, x, y, width, height, radius) {
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  const right = x + width;
  const bottom = y + height;
  context.moveTo(x + radius, y);
  context.arcTo(right, y, right, bottom, radius);
  context.arcTo(right, bottom, x, bottom, radius);
  context.arcTo(x, bottom, x, y, radius);
  context.arcTo(x, y, right, y, radius);
  context.closePath();
}

function roundedFill(context, x, y, width, height, radius, color) {
  roundedPath(context, x, y, width, height, radius);
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

function drawCard(context) {
  const { width, height } = card;
  const showMute = materialType.value === "video" && muteToggle.checked;
  context.save();
  fillPhoto(context);

  const shade = context.createLinearGradient(0, 660, 0, height);
  shade.addColorStop(0, "transparent");
  shade.addColorStop(.50, "#06100f38");
  shade.addColorStop(1, "#06100f64");
  context.fillStyle = shade;
  context.fillRect(0, 660, width, height - 660);
  context.fillStyle = "#ffffffb8";
  for (const x of [708, 722, 735]) {
    context.beginPath();
    context.arc(x, 81, 3.3, 0, 2 * Math.PI);
    context.fill();
  }

  const left = 35;
  const textWidth = width - left * 2;
  const brand = singleLine(fields.brand.value);
  const title = singleLine(fields.title.value);
  const body = singleLine(fields.body.value);
  const cta = singleLine(fields.cta.value);
  const titleFont = `600 43px ${fontFamily}`;
  const titleSpacing = "1.3px";
  const titleLineHeight = 61;
  context.font = titleFont;
  context.letterSpacing = titleSpacing;
  const lines = titleLines(context, title, textWidth - 8);
  // Keep the last title line anchored above the body and move the advertiser row with it.
  const titleOffset = (2 - lines.length) * titleLineHeight;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "white";
  context.strokeStyle = "#ffffffe0";
  context.lineWidth = 1.3;
  roundedPath(context, left, 806 + titleOffset, 48, 31, 6);
  context.stroke();
  context.font = `300 19px ${fontFamily}`;
  context.letterSpacing = ".38px";
  context.fillText("廣告", left + 5, 827 + titleOffset);

  drawLogo(context, 96, 804 + titleOffset, 36);
  const brandX = 145;
  context.fillStyle = "white";
  context.font = `400 28px ${fontFamily}`;
  context.letterSpacing = ".56px";
  context.fillText(ellipsis(context, brand, width - brandX - left), brandX, 832 + titleOffset);

  context.font = titleFont;
  context.letterSpacing = titleSpacing;
  for (const [index, line] of lines.entries()) {
    context.fillText(line, left, 908 + titleOffset + titleLineHeight * index);
  }
  context.font = `400 32px ${fontFamily}`;
  context.letterSpacing = ".3px";
  context.fillText(ellipsis(context, body, textWidth, "..."), left, 1038);

  const buttonWidth = showMute ? 638 : textWidth;
  roundedFill(context, left, 1086, buttonWidth, 69, 34.5, byId("button-color").value);
  context.font = `600 28px ${fontFamily}`;
  context.letterSpacing = "0px";
  const buttonText = ellipsis(context, cta, buttonWidth - 24);
  context.fillStyle = "white";
  context.textAlign = "center";
  context.fillText(buttonText, left + buttonWidth / 2, 1132);
  if (showMute) drawMute(context);
  context.restore();
}

function customScreenshotTime() {
  const time = screenshotTime?.value ?? "";
  return time !== "15:27" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "";
}

function drawScreenshotHeader(context) {
  context.save();
  context.textBaseline = "alphabetic";
  const time = customScreenshotTime();
  if (time) {
    context.fillStyle = "#fcfcfc";
    context.fillRect(99, 27, 120, 40);
    context.font = `600 37px -apple-system, BlinkMacSystemFont, ${clockFontFamily}`;
    context.fillStyle = "#080808";
    context.textAlign = "center";
    context.fillText(time, 158.5, 61);
  }

  // Rebuild the row after 「分類」 using a clear gap from the original screenshot.
  context.drawImage(screenshotFrame, 568, 263, 1, 88, 570, 263, screenshot.width - 570, 88);
  const top = 269;
  const height = 77;
  const padding = 36;
  const minWidth = 130;
  const gap = 12;
  const fill = context.createLinearGradient(0, top, 0, top + height);
  fill.addColorStop(0, "#fcfcfc");
  fill.addColorStop(1, "#fff");
  context.font = `700 28px "PingFang TC", ${fontFamily}`;
  context.textAlign = "center";
  context.strokeStyle = "#e3e3e3";
  context.lineWidth = 2;
  let left = 574;
  for (const field of screenshotCategories) {
    const name = singleLine(field?.value ?? "");
    const width = Math.max(minWidth, Math.ceil(context.measureText(name).width) + padding * 2);
    roundedPath(context, left, top, width, height, height / 2);
    context.fillStyle = fill;
    context.fill();
    context.stroke();
    context.fillStyle = "#191919";
    context.fillText(name, left + width / 2, 317);
    // Let the canvas edge clip the button and its unscaled text.
    left += width + gap;
  }
  context.restore();
}

function drawComposition(context, isScreenshot) {
  if (isScreenshot && !screenshotFrame) return;
  drawCard(cardContext);
  if (isScreenshot) {
    context.drawImage(cardSurface, screenshot.cardX, screenshot.cardY);
    context.drawImage(screenshotFrame, 0, 0);
    drawScreenshotHeader(context);
    return;
  }
  context.save();
  roundedPath(context, 0, 0, card.width, card.height, cardRadius);
  context.clip();
  context.drawImage(cardSurface, 0, 0);
  context.restore();
}

function drawSafeArea(context, isScreenshot) {
  // Project the centered 888 × 1152 design safe area into the visible card.
  const x = 96 * cardScale;
  const y = (384 - cardTop) * cardScale;
  const width = 888 * cardScale;
  const height = 1152 * cardScale;
  context.save();
  if (isScreenshot) context.translate(screenshot.cardX, screenshot.cardY);
  roundedPath(context, 0, 0, card.width, card.height, cardRadius);
  context.clip();
  context.beginPath();
  context.rect(0, 0, card.width, card.height);
  context.rect(x, y, width, height);
  context.fillStyle = "#11241966";
  context.fill("evenodd");
  context.strokeStyle = "#f3ffb8";
  context.lineWidth = 2;
  context.setLineDash([8, 5]);
  context.strokeRect(x, y, width, height);
  context.restore();
}

function requestDraw() {
  if (redrawPending) return;
  redrawPending = true;
  requestAnimationFrame(() => {
    redrawPending = false;
    previewContext.clearRect(0, 0, canvas.width, canvas.height);
    const isScreenshot = state.mode === "screenshot";
    drawComposition(previewContext, isScreenshot);
    if (byId("show-safe").checked && (!isScreenshot || screenshotFrame)) {
      drawSafeArea(previewContext, isScreenshot);
    }

    const logoContext = byId("logo-thumb").getContext("2d");
    logoContext.clearRect(0, 0, 24, 24);
    drawLogo(logoContext, 0, 0, 24);
  });
}

function setMode(mode) {
  state.mode = mode;
  const isCard = mode === "card";
  const size = isCard ? card : screenshot;
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.setAttribute("aria-label", isCard ? "廣告卡片預覽，可用方向鍵移動主圖" : "螢幕截圖預覽，可用方向鍵移動卡片主圖");
  byId("art-frame").dataset.mode = mode;
  byId("card-mode").setAttribute("aria-pressed", String(isCard));
  byId("screenshot-mode").setAttribute("aria-pressed", String(!isCard));
  if (!isCard) prepareScreenshotClock();
  requestDraw();
}

function updateMaterialType() {
  muteToggle.disabled = materialType.value === "image";
  requestDraw();
}

function setStatus(text, error = false) {
  const status = byId("status");
  status.dataset.error = String(error);
  status.textContent = text;
}

function setCropValue(key, value) {
  const { range } = cropControls[key];
  state[key] = clamp(value, Number(range.min), Number(range.max));
}

function syncCropControl(key) {
  const { range, number } = cropControls[key];
  range.value = number.value = Math.round(state[key]);
}

function resetCrop() {
  Object.assign(state, defaultCrop);
  for (const key of Object.keys(cropControls)) syncCropControl(key);
  requestDraw();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function loadWebFont(family, timeout = 10_000) {
  const faces = Array.from(document.fonts ?? []).filter(
    (face) => face.family.replace(/^["']|["']$/g, "") === family,
  );
  if (!faces.length) return false;

  let timer;
  try {
    return await Promise.race([
      Promise.all(faces.map((face) => face.load())).then(() => true),
      new Promise((resolve) => { timer = window.setTimeout(() => resolve(false), timeout); }),
    ]);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadCardFonts() {
  for (const family of ["Source Han Sans TW", "Taiwan Card Sans"]) {
    if (await loadWebFont(family)) {
      fontFamily = `"${family}", sans-serif`;
      requestDraw();
      return;
    }
  }
  const notice = byId("font-status");
  if (notice) notice.hidden = false;
}

function prepareScreenshotClock() {
  if (!customScreenshotTime()) return;
  clockFontReady ??= loadWebFont("Screenshot Clock", 2_500).then((loaded) => {
    if (loaded) {
      clockFontFamily = '"Screenshot Clock", sans-serif';
      requestDraw();
    }
  });
  return clockFontReady;
}

function setMainImage(image, filename = "") {
  state.image = image;
  const name = byId("image-name");
  name.textContent = filename || (image ? "示範主圖" : "尚未選擇圖片");
  name.title = filename;
  byId("image-meta").textContent = filename
    ? `${image.naturalWidth} × ${image.naturalHeight} px`
    : "可拖曳 JPG、PNG 或 WebP 到這裡";
  // The previous HTML can still be cached without the new remove button.
  if (removeImageButton) removeImageButton.hidden = !image;
  resetCrop();
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
    if (isLogo) {
      state.logo = image;
      byId("logo-action").textContent = "更換";
      byId("remove-logo").hidden = false;
      setStatus(`已更換 Logo（${file.name}）`);
      requestDraw();
    } else {
      setMainImage(image, file.name);
      setStatus("已套用主圖");
    }
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

function moveByPixels(dx, dy) {
  if (!state.image || state.zoom === 0) return;
  const pixelRatio = canvas.width / canvas.getBoundingClientRect().width;
  setCropValue("x", state.x + dx * pixelRatio);
  setCropValue("y", state.y + dy * pixelRatio);
  syncCropControl("x");
  syncCropControl("y");
  requestDraw();
}

canvas.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  if (state.mode === "screenshot") {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * screenshot.width / bounds.width;
    const y = (event.clientY - bounds.top) * screenshot.height / bounds.height;
    if (x < screenshot.cardX || x >= screenshot.cardX + card.width ||
        y < screenshot.cardY || y >= screenshot.cardY + card.height) return;
  }
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (drag?.id !== event.pointerId) return;
  moveByPixels(event.clientX - drag.x, event.clientY - drag.y);
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
  moveByPixels(direction[0] * step, direction[1] * step);
});

function encode(output, format, quality) {
  return new Promise((resolve, reject) => {
    output.toBlob((blob) => {
      if (blob?.type === `image/${format}`) resolve(blob);
      else reject(new Error("無法輸出此格式，請換一種格式重試。"));
    }, `image/${format}`, quality);
  });
}

async function saveImage(isScreenshot) {
  if (!state.image) {
    setStatus("請先選擇一張主圖。", true);
    return;
  }
  const buttons = [byId("save-screenshot"), byId("save-preview")];
  buttons.forEach((button) => { button.disabled = true; });
  setStatus("正在製作圖片…");
  try {
    const format = isScreenshot ? "png" : byId("format").value;
    await fontsReady;
    if (isScreenshot) {
      if (!await screenshotReady) throw new Error("螢幕截圖底圖載入失敗，請重新整理後再試。");
      await prepareScreenshotClock();
    }
    if (!state.image) throw new Error("請先選擇一張主圖。");
    const output = document.createElement("canvas");
    const size = isScreenshot ? screenshot : card;
    output.width = size.width;
    output.height = size.height;
    const context = output.getContext("2d", { alpha: !isScreenshot && format === "png" });
    if (format === "jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, size.width, size.height);
    }
    drawComposition(context, isScreenshot);
    const blob = await encode(output, format, .94);
    const filename = format === "jpeg" ? "jpg" : "png";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `line-today-${isScreenshot ? "screenshot" : "preview"}.${filename}`;
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

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Some embedded browsers expose the API but reject writes.
    }
  }
  const buffer = document.createElement("textarea");
  buffer.value = text;
  buffer.style.cssText = "position:fixed;left:0;top:0;opacity:0";
  document.body.append(buffer);
  try {
    buffer.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    buffer.remove();
    byId("copy-text").focus();
  }
}

async function copyText() {
  const text = [
    `廠商名稱：${fields.brand.value}`,
    `標題：${fields.title.value}`,
    `內文：${fields.body.value}`,
    `按鈕：${fields.cta.value}`,
  ].join("\n");
  const copied = await writeClipboard(text);
  setStatus(copied ? "已複製文案" : "瀏覽器未允許複製，請手動選取欄位中的文字。", !copied);
}

for (const [key, field] of Object.entries(fields)) {
  field.value = demo[key];
  field.addEventListener("input", updateCopy);
}
setupUpload(imageFile, byId("drop-image"), "image");
removeImageButton?.addEventListener("click", () => {
  imageRequest++;
  setMainImage(null);
  imageFile.focus();
  setStatus("已移除主圖");
});
setupUpload(byId("logo-file"), byId("drop-logo"), "logo");
byId("remove-logo").addEventListener("click", () => {
  logoRequest++;
  state.logo = null;
  byId("remove-logo").hidden = true;
  byId("logo-action").textContent = "上傳";
  requestDraw();
});
for (const [key, { range, number }] of Object.entries(cropControls)) {
  range.addEventListener("input", () => {
    state[key] = range.valueAsNumber;
    number.value = range.value;
    requestDraw();
  });
  number.addEventListener("input", () => {
    if (!Number.isFinite(number.valueAsNumber)) return;
    setCropValue(key, Math.round(number.valueAsNumber));
    range.value = state[key];
    requestDraw();
  });
  number.addEventListener("blur", () => syncCropControl(key));
  number.addEventListener("keydown", (event) => {
    if (event.key === "Enter") syncCropControl(key);
  });
}
byId("reset-crop").addEventListener("click", resetCrop);
byId("copy-text").addEventListener("click", copyText);
byId("card-mode").addEventListener("click", () => setMode("card"));
byId("screenshot-mode").addEventListener("click", () => setMode("screenshot"));
for (const field of [screenshotTime, ...screenshotCategories]) {
  field?.addEventListener("input", () => {
    if (state.mode !== "screenshot") {
      setMode("screenshot");
      return;
    }
    prepareScreenshotClock();
    requestDraw();
  });
}
materialType.addEventListener("change", updateMaterialType);
for (const control of [byId("show-safe"), muteToggle, byId("button-color")]) control.addEventListener("input", requestDraw);
byId("save-screenshot").addEventListener("click", () => saveImage(true));
byId("save-preview").addEventListener("click", () => saveImage(false));
const fontsReady = loadCardFonts();
const screenshotReady = loadImage("./assets/screenshot-frame.png").then((image) => {
  screenshotFrame = image;
  requestDraw();
  return true;
}).catch(() => {
  setStatus("螢幕截圖底圖載入失敗，請重新整理後再試。", true);
  return false;
});
loadImage("./assets/demo.jpg").then((image) => {
  if (state.image === undefined) setMainImage(image);
}).catch(() => {
  if (state.image === undefined) {
    setMainImage(null);
    setStatus("示範圖片未載入。你仍可上傳自己的主圖。", true);
  }
});
setMode("card");
updateMaterialType();
updateCopy();
