"use strict";

// Finance OS app, part: Arranging the dashboard ("Anordnen"): drag, resize, hide.
// Loaded by app.html in this order: state.js → calc.js → render.js → render-settings.js → future.js → layout.js → navigation.js → forms.js → main.js

// Arranging the blocks on the dashboard ("Anordnen").
// The dashboard is a grid of 24 columns. Every block has a column (x) and a width (w); it sits
// as high up in its columns as there is room, so it can be put anywhere, also into a gap
// below a short block. While arranging:
// - drag a block by its bar: it follows the pointer, a dashed area shows where it will land,
//   the other blocks glide out of the way;
// - drag the left or right edge to make it wider or narrower;
// - keyboard: arrow keys move the focused bar, Shift + left/right changes the width;
// - "Ausblenden" hides a block; while arranging it stays visible (faded) to show it again;
// - a click outside the blocks ends arranging.
// Saved with the account; phone and computer have their own positions:
// state.layout = { dashboard: [ids in order], grid: { desktop: { id: { x, w } }, phone: { … } }, hidden: [ids] }

const COLUMNS = 24;
const DEFAULT_LAYOUT = {};
document.querySelectorAll("[data-sortable]").forEach((container) => {
  DEFAULT_LAYOUT[container.dataset.sortable] = [...container.children].map((block) => block.dataset.block);
  [...container.children].forEach((block) => (block.dataset.defaultSize = block.classList.contains("span-2") ? "wide" : "narrow"));
});

const PHONE = window.matchMedia("(max-width: 760px)");
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
const deviceKey = () => (PHONE.matches ? "phone" : "desktop");

function blocksOf(name) {
  return [...document.querySelector(`[data-sortable="${name}"]`).children].filter((el) => el.matches(".block:not(.block-placeholder)"));
}

// Default order; the account blocks come right after "still available".
function defaultOrder(name) {
  const order = [...DEFAULT_LAYOUT[name]];
  if (name === "dashboard") order.splice(order.indexOf("available") + 1, 0, ...state.accounts.map((account) => "account-" + account.id));
  return order;
}

// Width in columns when nothing is saved (older layouts saved "wide" / "narrow" or percent).
function defaultColumns(name, block, device) {
  const saved = state.layout?.sizes?.[`${name}${device === "phone" ? "-phone" : ""}:${block.dataset.block}`];
  if (typeof saved === "number") return Math.max(1, Math.round((saved * COLUMNS) / 100));
  if (saved === "wide") return COLUMNS;
  if (saved === "narrow") return COLUMNS / 2;
  if (device === "phone") return block.dataset.block.startsWith("account-") ? COLUMNS / 2 : COLUMNS;
  return block.dataset.defaultSize === "wide" ? COLUMNS : COLUMNS / 2;
}

// Column and width of every block: saved ones as saved, the others side by side like text lines.
function gridOf(name, device = deviceKey()) {
  const saved = state.layout?.grid?.[device] || {};
  const result = {};
  let cursor = 0;
  for (const block of blocksOf(name)) {
    const id = block.dataset.block;
    const w = Math.min(COLUMNS, defaultColumns(name, block, device));
    if (cursor + w > COLUMNS) cursor = 0;
    result[id] = saved[id] ? { ...saved[id] } : { x: cursor, w };
    cursor = (cursor + w) % COLUMNS;
  }
  return result;
}

// Smallest width (px) a block is shown with; narrower ones are widened automatically.
const MIN_BLOCK_WIDTH = 300;
const MIN_ACCOUNT_WIDTH = 140;

let currentGrid = null; // { x, w } per block id while the page is shown

// Places the blocks: each one as high as possible in its columns, in the saved order.
// `floating` (the block being dragged) is left out; its placeholder takes its place.
function placeBlocks(name, floating = null) {
  const container = document.querySelector(`[data-sortable="${name}"]`);
  const width = container.clientWidth;
  if (!width) return;
  const gap = parseFloat(getComputedStyle(container).getPropertyValue("--gap")) || 14;
  const unit = (width + gap) / COLUMNS;
  const items = [...container.children].filter((el) => el !== floating && el.matches(".block") && !el.matches(".block-hidden:not(.arranging > *)"));
  // Set all widths first, then measure all heights (one layout pass instead of many).
  for (const el of items) {
    let { x, w } = currentGrid[el.dataset.block || el.dataset.placeholderFor] || { x: 0, w: COLUMNS };
    // Never too narrow for its content (e.g. a small block on a phone): then it gets as many
    // columns as it needs, up to the whole row – so nothing is cut off or squeezed.
    const id = el.dataset.block || el.dataset.placeholderFor || "";
    const minWidth = id.startsWith("account-") ? MIN_ACCOUNT_WIDTH : MIN_BLOCK_WIDTH;
    if (w * unit - gap < minWidth) {
      w = Math.min(COLUMNS, Math.ceil((minWidth + gap) / unit));
      // No room left beside it for another block: use the whole row, it looks tidier
      if ((COLUMNS - w) * unit - gap < MIN_ACCOUNT_WIDTH) w = COLUMNS;
      x = Math.min(x, COLUMNS - w);
    }
    el.style.width = `${w * unit - gap}px`;
    el._x = x;
    el._w = w;
  }
  const heights = items.map((el) => (el._h = el.offsetHeight));
  const skyline = new Array(COLUMNS).fill(0);
  items.forEach((el, i) => {
    const columns = skyline.slice(el._x, el._x + el._w);
    const top = Math.max(...columns);
    el._top = top;
    el.style.transform = `translate(${el._x * unit}px, ${top}px)`;
    for (let c = el._x; c < el._x + el._w; c++) skyline[c] = top + heights[i] + gap;
  });
  container.style.height = `${Math.max(0, Math.max(...skyline) - gap)}px`;
  container._unit = unit;
}

const layoutObserver = new ResizeObserver(() => {
  if (layoutObserver.pending) return;
  layoutObserver.pending = requestAnimationFrame(() => {
    layoutObserver.pending = null;
    if (!dragState) for (const name of Object.keys(DEFAULT_LAYOUT)) placeBlocks(name);
  });
});

// Puts the blocks in the saved order and position; blocks without a saved place keep their default place.
function applyLayout() {
  for (const name of Object.keys(DEFAULT_LAYOUT)) {
    const container = document.querySelector(`[data-sortable="${name}"]`);
    const byId = Object.fromEntries(blocksOf(name).map((block) => [block.dataset.block, block]));
    const saved = (state.layout?.[name] || []).filter((id) => byId[id]);
    const defaults = defaultOrder(name).filter((id) => byId[id]);
    // Unsaved blocks (e.g. a new savings account) are put after the block before them by default.
    const order = [...saved];
    defaults.forEach((id, i) => {
      if (order.includes(id)) return;
      const previous = defaults.slice(0, i).reverse().find((other) => order.includes(other));
      order.splice(previous ? order.indexOf(previous) + 1 : 0, 0, id);
    });
    order.forEach((id) => container.append(byId[id]));
    blocksOf(name).forEach(markHidden);
    currentGrid = gridOf(name);
    layoutObserver.observe(container);
    blocksOf(name).forEach((block) => layoutObserver.observe(block));
    placeBlocks(name);
    // Animate later changes, not the first placement.
    requestAnimationFrame(() => container.classList.add("animated"));
  }
}

PHONE.addEventListener("change", () => {
  for (const name of Object.keys(DEFAULT_LAYOUT)) {
    currentGrid = gridOf(name);
    placeBlocks(name);
  }
});

// Order = from top to bottom, left to right, as the blocks are placed now.
function saveLayout(name) {
  const blocks = blocksOf(name).sort((a, b) => a._top - b._top || a._x - b._x);
  const container = document.querySelector(`[data-sortable="${name}"]`);
  blocks.forEach((block) => container.append(block));
  state.layout = {
    ...state.layout,
    [name]: blocks.map((block) => block.dataset.block),
    grid: { ...state.layout?.grid, [deviceKey()]: { ...currentGrid } },
  };
  save();
}

// The bar (drag handle with the name) and the resize edge shown while arranging; added once per block.
function addBlockBar(block) {
  if (block.querySelector(":scope > [data-block-bar]")) return;
  const name = escapeHTML(block.dataset.blockPlain ? block.dataset.blockName : t(block.dataset.blockName));
  block.insertAdjacentHTML(
    "afterbegin",
    `<div class="block-bar" data-block-bar tabindex="0" role="button"
        aria-label="${t("{name} verschieben: Pfeiltasten. Breite: Umschalt + Pfeiltasten.", { name })}">
      <span class="block-grip" aria-hidden="true">⠿</span>
      <span class="block-name">${name}</span>
      <button type="button" class="secondary block-hide" data-action="toggle-block" data-block-id="${escapeHTML(block.dataset.block)}">
        <svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
        <svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.8 8.3 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.7-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
      </button>
    </div>`,
  );
  block.insertAdjacentHTML(
    "beforeend",
    `<div class="block-resize block-resize-left" data-block-resize="left" aria-hidden="true" title="${t("Breiter oder schmaler ziehen")}"></div>
     <div class="block-resize" data-block-resize="right" aria-hidden="true" title="${t("Breiter oder schmaler ziehen")}"></div>`,
  );
  block.insertAdjacentHTML("beforeend", `<span class="block-hidden-label" aria-hidden="true">${t("Ausgeblendet")}</span>`);
}

const hiddenBlocks = () => state.layout?.hidden || [];

function markHidden(block) {
  const hidden = hiddenBlocks().includes(block.dataset.block);
  block.classList.toggle("block-hidden", hidden);
  const button = block.querySelector(":scope > [data-block-bar] .block-hide");
  if (!button) return;
  const name = block.dataset.blockPlain ? block.dataset.blockName : t(block.dataset.blockName);
  button.title = hidden ? t("Einblenden") : t("Ausblenden");
  button.setAttribute("aria-label", t(hidden ? "{name} einblenden" : "{name} ausblenden", { name }));
}

// Hides a block on the dashboard or shows it again.
function toggleBlock(data) {
  const block = document.querySelector(`[data-sortable] > [data-block="${data.blockId}"]`);
  const hidden = hiddenBlocks().filter((id) => id !== data.blockId);
  if (!block.classList.contains("block-hidden")) hidden.push(data.blockId);
  state.layout = { ...state.layout, hidden };
  markHidden(block);
  const name = block.parentElement.dataset.sortable;
  placeBlocks(name);
  saveLayout(name);
}

const addBlockBars = () => document.querySelectorAll("[data-sortable] > .block").forEach(addBlockBar);

function setArranging(name, on) {
  const container = document.querySelector(`[data-sortable="${name}"]`);
  container.classList.toggle("arranging", on);
  document.querySelector(`[data-arrange-help="${name}"]`).hidden = !on;
  const toggle = document.querySelector(`[data-action="arrange"][data-sortable-for="${name}"]`);
  toggle.setAttribute("aria-pressed", String(on));
  toggle.textContent = on ? t("Fertig") : t("Anordnen");
  placeBlocks(name);
}

// A click outside the blocks ends arranging (everything is already saved).
// The click that the browser sends right after letting go of a dragged or resized block does
// not count: arranging stays on until "Fertig" or a real click outside.
let lastArrangeGesture = 0;
document.addEventListener("click", (event) => {
  const container = document.querySelector("[data-sortable].arranging");
  if (!container || dragState || Date.now() - lastArrangeGesture < 300) return;
  if (event.target.closest("[data-sortable] > .block, [data-action='arrange'], .arrange-help, .toast, dialog")) return;
  setArranging(container.dataset.sortable, false);
});

function toggleArranging(data) {
  const container = document.querySelector(`[data-sortable="${data.sortableFor}"]`);
  setArranging(data.sortableFor, !container.classList.contains("arranging"));
}

function resetLayout(data) {
  const name = data.sortableFor;
  if (state.layout) {
    delete state.layout[name];
    delete state.layout.grid;
    delete state.layout.hidden;
    for (const key of Object.keys(state.layout.sizes || {})) {
      if (key.startsWith(name + ":") || key.startsWith(name + "-phone:")) delete state.layout.sizes[key];
    }
  }
  applyLayout();
  save();
}

const minColumns = (container) => Math.ceil(((PHONE.matches ? 130 : 160) + 14) / container._unit);

let dragState = null;

// Moving: the block follows the pointer; the placeholder shows where it will land.
function startMove(event, bar) {
  const block = bar.closest(".block");
  const container = block.parentElement;
  const name = container.dataset.sortable;
  const box = block.getBoundingClientRect();
  const offsetX = event.clientX - box.left;
  const offsetY = event.clientY - box.top;
  event.preventDefault();

  const placeholder = document.createElement("div");
  placeholder.className = "block block-placeholder";
  placeholder.dataset.placeholderFor = block.dataset.block;
  placeholder.style.height = `${box.height}px`;
  placeholder.style.transform = block.style.transform;
  block.after(placeholder);
  block.classList.add("dragging");
  dragState = { block };
  const fullWidth = currentGrid[block.dataset.block].w; // own width; narrower only to fit a gap

  let lastX = event.clientX;
  let lastY = event.clientY;
  let frame = null;

  const update = () => {
    const area = container.getBoundingClientRect();
    const left = lastX - offsetX - area.left;
    const top = lastY - offsetY - area.top;
    block.style.transform = `translate(${left}px, ${top}px)`;
    // Column under the left edge of the block; it stays inside the grid and lines up with
    // the edges of the other blocks when it is close to one.
    const item = currentGrid[block.dataset.block];
    const others = blocksOf(name).filter((el) => el !== block);
    const exact = left / container._unit;
    const edges = [0, COLUMNS - fullWidth, ...others.flatMap((el) => [el._x, el._x + el._w])];
    const nearest = edges.reduce((best, edge) => (Math.abs(edge - exact) < Math.abs(best - exact) ? edge : best), Infinity);
    const column = Math.abs(nearest - exact) <= 1.5 ? nearest : Math.round(exact);
    const snappedX = Math.min(COLUMNS - fullWidth, Math.max(0, column));
    const pointerColumn = Math.min(COLUMNS - 1, Math.max(0, Math.floor((lastX - area.left) / container._unit)));
    const gap = parseFloat(getComputedStyle(container).getPropertyValue("--gap")) || 14;
    const minimum = minColumns(container);

    // Free columns before the block at position `index` in the order (the "skyline").
    const skylineBefore = (index) => {
      const skyline = new Array(COLUMNS).fill(0);
      for (const el of others.slice(0, index)) {
        const at = Math.max(...skyline.slice(el._x, el._x + el._w));
        for (let c = el._x; c < el._x + el._w; c++) skyline[c] = at + el._h + gap;
      }
      return skyline;
    };

    // Try every position in the order, each with the block's own width and, if the pointer is
    // over a narrower gap, made narrow enough to fit into it. Take the place closest to where
    // the pointer holds the block; with equal distance the one that moves the others the least
    // (later in the order), then the wider one.
    let choice = null;
    for (let i = 0; i <= others.length; i++) {
      const skyline = skylineBefore(i);
      const candidates = [{ x: snappedX, w: fullWidth }];
      const level = skyline[pointerColumn];
      let from = pointerColumn;
      let to = pointerColumn + 1;
      while (from > 0 && skyline[from - 1] <= level) from--;
      while (to < COLUMNS && skyline[to] <= level) to++;
      const free = to - from;
      if (free < fullWidth && free >= minimum) candidates.push({ x: from, w: free });
      for (const candidate of candidates) {
        const landing = Math.max(...skyline.slice(candidate.x, candidate.x + candidate.w));
        const distance = Math.abs(landing - top);
        const tie = Math.abs(distance - choice?.distance) <= 1;
        if (!choice || distance < choice.distance - 1 || (tie && (i > choice.index || (i === choice.index && candidate.w > choice.w)))) {
          choice = { ...candidate, index: i, distance };
        }
      }
    }
    const { index, x } = choice;
    const widthChanged = item.w !== choice.w;
    item.w = choice.w;
    const next = others[index] || null;
    if (widthChanged || item.x !== x || placeholder.nextElementSibling !== next || placeholder.previousElementSibling !== (others[index - 1] || null)) {
      item.x = x;
      if (next) next.before(placeholder);
      else container.append(placeholder);
      placeBlocks(name, block);
    }
  };

  const autoScroll = () => {
    const step = lastY < 80 ? -14 : lastY > innerHeight - 80 ? 14 : 0;
    if (step) {
      window.scrollBy(0, step);
      update();
    }
    frame = requestAnimationFrame(autoScroll);
  };
  frame = requestAnimationFrame(autoScroll);

  const onMove = (move) => {
    lastX = move.clientX;
    lastY = move.clientY;
    update();
  };
  // If the page scrolls (also by itself), the block stays under the finger.
  const onScroll = () => update();
  window.addEventListener("scroll", onScroll, { passive: true });
  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    window.removeEventListener("scroll", onScroll);
    cancelAnimationFrame(frame);
    // Glide into the placeholder's place, then take it.
    placeholder.replaceWith(block);
    block.classList.remove("dragging");
    dragState = null;
    lastArrangeGesture = Date.now();
    placeBlocks(name);
    saveLayout(name);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
}

// Resizing: drag the left or right edge; the width snaps to the columns.
// Blocks right next to that edge (in the same row) share it: they get narrower or wider by the
// same amount, their other edge stays where it is. Without a neighbour the others make room.
function startResize(event, handle) {
  const block = handle.closest(".block");
  const container = block.parentElement;
  const name = container.dataset.sortable;
  const item = currentGrid[block.dataset.block];
  const fromLeft = handle.dataset.blockResize === "left";
  const startX = event.clientX;
  const left = item.x;
  const right = item.x + item.w;
  const edge = fromLeft ? left : right;
  const minimum = (width) => Math.min(minColumns(container), width);
  const overlaps = (el) => el._top < block._top + block._h && block._top < el._top + el._h;
  // Neighbours touching this edge, with their position at the start
  const neighbours = blocksOf(name)
    .filter((el) => el !== block && !el.matches(".block-hidden:not(.arranging > *)") && overlaps(el))
    .filter((el) => (fromLeft ? el._x + el._w === left : el._x === right))
    .map((el) => ({ item: currentGrid[el.dataset.block], x: el._x, w: el._w }));
  event.preventDefault();
  block.classList.add("resizing");

  const onMove = (move) => {
    let boundary = edge + Math.round((move.clientX - startX) / container._unit);
    if (fromLeft) {
      boundary = Math.min(right - minimum(item.w), Math.max(0, boundary));
      for (const n of neighbours) boundary = Math.max(boundary, n.x + minimum(n.w));
    } else {
      boundary = Math.max(left + minimum(item.w), Math.min(COLUMNS, boundary));
      for (const n of neighbours) boundary = Math.min(boundary, n.x + n.w - minimum(n.w));
    }
    const x = fromLeft ? boundary : left;
    const w = fromLeft ? right - boundary : boundary - left;
    block.dataset.size = `${Math.round((w * 100) / COLUMNS)} %`;
    if (w === item.w && x === item.x) return;
    item.x = x;
    item.w = w;
    for (const n of neighbours) {
      if (fromLeft) n.item.w = boundary - n.x; // its left edge stays
      else {
        n.item.x = boundary; // its right edge stays
        n.item.w = n.x + n.w - boundary;
      }
    }
    placeBlocks(name);
  };
  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    block.classList.remove("resizing");
    lastArrangeGesture = Date.now();
    saveLayout(name);
  };
  block.dataset.size = `${Math.round((item.w * 100) / COLUMNS)} %`;
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
}

document.addEventListener("pointerdown", (event) => {
  if (!ready || event.button > 0 || !event.target.closest(".arranging")) return;
  const handle = event.target.closest("[data-block-resize]");
  if (handle) return startResize(event, handle);
  const bar = event.target.closest("[data-block-bar]");
  if (bar && !event.target.closest("button")) startMove(event, bar);
});

// Keyboard: up/down change the order, left/right the column, Shift + left/right the width.
document.addEventListener("keydown", (event) => {
  const bar = event.target.closest?.("[data-block-bar]");
  if (!ready || !bar || event.target.closest("button") || !bar.closest(".arranging") || !event.key.startsWith("Arrow")) return;
  event.preventDefault();
  const block = bar.closest(".block");
  const container = block.parentElement;
  const name = container.dataset.sortable;
  const item = currentGrid[block.dataset.block];
  const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    if (step < 0) block.previousElementSibling?.before(block);
    else block.nextElementSibling?.after(block);
  } else if (event.shiftKey) {
    item.w = Math.min(COLUMNS - item.x, Math.max(minColumns(container), item.w + step * 2));
  } else {
    item.x = Math.min(COLUMNS - item.w, Math.max(0, item.x + step * 2));
  }
  placeBlocks(name);
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    // keep the order as chosen (not re-sorted by position)
    state.layout = { ...state.layout, [name]: blocksOf(name).map((el) => el.dataset.block), grid: { ...state.layout?.grid, [deviceKey()]: { ...currentGrid } } };
    save();
  } else saveLayout(name);
  bar.focus();
});
