import { TARGETS, allTargetIds } from "./targets.mjs";

const ENTER_ALT_SCREEN = "\u001b[?1049h";
const EXIT_ALT_SCREEN = "\u001b[?1049l";
const HIDE_CURSOR = "\u001b[?25l";
const SHOW_CURSOR = "\u001b[?25h";
const ENABLE_MOUSE = "\u001b[?1000h\u001b[?1006h";
const DISABLE_MOUSE = "\u001b[?1000l\u001b[?1006l";
const CLEAR_SCREEN = "\u001b[2J\u001b[H";

// One solid terminal color per ASCII letter.
export const BANNER_COLORS = Object.freeze([
  { hex: "#00d7d7", ansi256: 44 },
  { hex: "#5fafff", ansi256: 75 },
  { hex: "#87d7ff", ansi256: 117 },
  { hex: "#00afff", ansi256: 39 },
  { hex: "#5fffff", ansi256: 87 },
  { hex: "#87afff", ansi256: 111 },
].map(Object.freeze));

// The original FIGlet letter boundaries; preserve every space and glyph.
export const BANNER_COLUMNS = Object.freeze([0, 7, 14, 21, 28, 35, 43]);

export function bannerColorDepth(output, env = process.env) {
  if (!output?.isTTY || env.NO_COLOR !== undefined || env.TERM === "dumb") return 0;
  const depth = output.getColorDepth?.(env) ?? 0;
  return depth >= 24 ? 24 : depth >= 8 ? 8 : 0;
}

export function bannerLines(version, { colorDepth = 0 } = {}) {
  const lines = [
    "  ___   _   _   ___   ____   _   _  __  __",
    " / _ \\ | | | | / _ \\ |  _ \\ | | | ||  \\/  |",
    "| | | || | | || | | || |_) || | | || |\\/| |",
    "| |_| || |_| || |_| ||  _ < | |_| || |  | |",
    " \\__\\_\\ \\___/  \\___/ |_| \\_\\ \\___/ |_|  |_|",
    "",
    `                    QUORUM v${version}`,
  ];
  if (colorDepth < 8) return lines;
  return lines.map((line, row) => row >= 5 ? line : BANNER_COLORS.map((color, index) => {
    const fragment = line.slice(BANNER_COLUMNS[index], BANNER_COLUMNS[index + 1]);
    const rgb = color.hex.slice(1).match(/../g).map(value => Number.parseInt(value, 16));
    const code = colorDepth >= 24 ? `38;2;${rgb.join(";")}` : `38;5;${color.ansi256}`;
    return `\u001b[${code}m${fragment}\u001b[0m`;
  }).join(""));
}

export function formatBanner(version, options) {
  return `${bannerLines(version, options).join("\n")}\n`;
}

export function createSelectionState(initialTargetIds = []) {
  const allowed = new Set(allTargetIds());
  const selected = new Set();
  for (const targetId of initialTargetIds) {
    if (!allowed.has(targetId)) throw new Error(`Unknown target: ${targetId}`);
    selected.add(targetId);
  }
  return { cursor: 0, selected, message: "" };
}

export function allSelected(state) {
  return state.selected.size === TARGETS.length;
}

export function moveCursor(state, delta) {
  const rowCount = TARGETS.length + 1;
  return {
    ...state,
    cursor: (state.cursor + delta + rowCount) % rowCount,
    message: "",
  };
}

export function toggleAt(state, index) {
  if (!Number.isInteger(index) || index < 0 || index > TARGETS.length) return state;

  if (index === 0) {
    return {
      ...state,
      cursor: index,
      selected: allSelected(state) ? new Set() : new Set(allTargetIds()),
      message: "",
    };
  }

  const selected = new Set(state.selected);
  const targetId = TARGETS[index - 1].id;
  if (selected.has(targetId)) selected.delete(targetId);
  else selected.add(targetId);
  return { ...state, cursor: index, selected, message: "" };
}

export function renderSelector(state, version, options) {
  const lines = [...bannerLines(version, options), "", "Select one or more targets:", ""];
  const rows = new Map();

  const addOption = (index, label, checked) => {
    const prefix = state.cursor === index ? ">" : " ";
    const mark = checked ? "x" : " ";
    lines.push(`${prefix} [${mark}] ${label}`);
    rows.set(lines.length, index);
  };

  addOption(0, "All", allSelected(state));
  lines.push("");
  TARGETS.forEach((target, index) => {
    addOption(index + 1, target.label, state.selected.has(target.id));
  });
  lines.push("", "Use Up/Down, Space, mouse, and Enter. Esc cancels.");
  if (state.message) lines.push(state.message);

  return { text: `${lines.join("\n")}\n`, rows };
}

function looksIncompleteEscape(sequence) {
  return /^\u001b(?:\[(?:<\d*(?:;\d*){0,2})?)?$/.test(sequence);
}

export function parseTerminalInput(buffer, { flush = false } = {}) {
  const events = [];
  let remaining = String(buffer);

  while (remaining.length > 0) {
    const mouse = remaining.match(/^\u001b\[<(\d+);(\d+);(\d+)([Mm])/);
    if (mouse) {
      const button = Number(mouse[1]);
      const primaryPress = mouse[4] === "M" && (button & 3) === 0 && (button & 64) === 0;
      if (primaryPress) {
        events.push({ type: "mouse", x: Number(mouse[2]), y: Number(mouse[3]) });
      }
      remaining = remaining.slice(mouse[0].length);
      continue;
    }

    if (remaining.startsWith("\u001b[A")) {
      events.push({ type: "up" });
      remaining = remaining.slice(3);
      continue;
    }
    if (remaining.startsWith("\u001b[B")) {
      events.push({ type: "down" });
      remaining = remaining.slice(3);
      continue;
    }

    if (remaining.startsWith("\u001b")) {
      if (!flush && looksIncompleteEscape(remaining)) break;
      events.push({ type: "cancel" });
      remaining = remaining.slice(1);
      continue;
    }

    const character = remaining[0];
    remaining = remaining.slice(1);
    if (character === " ") events.push({ type: "toggle" });
    else if (character === "\r" || character === "\n") events.push({ type: "confirm" });
    else if (character === "\u0003") events.push({ type: "cancel" });
  }

  return { events, remainder: remaining };
}

export function applySelectorEvent(state, event, rows = new Map()) {
  if (event.type === "up") return { state: moveCursor(state, -1) };
  if (event.type === "down") return { state: moveCursor(state, 1) };
  if (event.type === "toggle") return { state: toggleAt(state, state.cursor) };
  if (event.type === "mouse") {
    const index = rows.get(event.y);
    return { state: index === undefined ? state : toggleAt(state, index) };
  }
  if (event.type === "cancel") return { state, action: "cancel" };
  if (event.type === "confirm") {
    if (state.selected.size === 0) {
      return { state: { ...state, message: "Select at least one target." } };
    }
    return { state, action: "confirm" };
  }
  return { state };
}

export function runSelector({
  version,
  input = process.stdin,
  output = process.stdout,
  signals = process,
  env = process.env,
  initialTargetIds = [],
} = {}) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Interactive target selection requires a terminal; use --targets or --all");
  }

  return new Promise((resolve, reject) => {
    let state = createSelectionState(initialTargetIds);
    let rowMap = new Map();
    let buffered = "";
    let flushTimer;
    let cleaned = false;
    const previousRawMode = Boolean(input.isRaw);

    const render = () => {
      const rendered = renderSelector(state, version, { colorDepth: bannerColorDepth(output, env) });
      rowMap = rendered.rows;
      output.write(`${CLEAR_SCREEN}${rendered.text}`);
    };

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (flushTimer) clearTimeout(flushTimer);
      input.removeListener("data", onData);
      signals.removeListener("SIGTERM", onSignal);
      signals.removeListener("SIGHUP", onSignal);
      signals.removeListener("exit", cleanup);
      output.write(`${DISABLE_MOUSE}${SHOW_CURSOR}${EXIT_ALT_SCREEN}`);
      input.setRawMode(previousRawMode);
      input.pause?.();
    };

    const finish = (value) => {
      cleanup();
      resolve(value);
    };

    const handleEvents = (events) => {
      for (const event of events) {
        const result = applySelectorEvent(state, event, rowMap);
        state = result.state;
        if (result.action === "confirm") {
          finish(allTargetIds().filter((targetId) => state.selected.has(targetId)));
          return false;
        }
        if (result.action === "cancel") {
          finish(null);
          return false;
        }
      }
      render();
      return true;
    };

    const flushBuffered = () => {
      flushTimer = undefined;
      const parsed = parseTerminalInput(buffered, { flush: true });
      buffered = parsed.remainder;
      handleEvents(parsed.events);
    };

    function onData(chunk) {
      if (cleaned) return;
      if (flushTimer) clearTimeout(flushTimer);
      buffered += chunk.toString();
      const parsed = parseTerminalInput(buffered);
      buffered = parsed.remainder;
      if (!handleEvents(parsed.events)) return;
      if (buffered) flushTimer = setTimeout(flushBuffered, 40);
    }

    function onSignal() {
      finish(null);
    }

    try {
      input.setRawMode(true);
      input.resume?.();
      input.on("data", onData);
      signals.once("SIGTERM", onSignal);
      signals.once("SIGHUP", onSignal);
      signals.once("exit", cleanup);
      output.write(`${ENTER_ALT_SCREEN}${HIDE_CURSOR}${ENABLE_MOUSE}`);
      render();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
