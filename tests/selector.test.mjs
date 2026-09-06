import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  allSelected,
  applySelectorEvent,
  createSelectionState,
  parseTerminalInput,
  renderSelector,
  runSelector,
  toggleAt,
} from "../installer/selector.mjs";

test("All selects every tool and a tool deselection clears All", () => {
  let state = toggleAt(createSelectionState(), 0);
  assert.equal(allSelected(state), true);
  assert.equal(state.selected.size, 5);

  state = toggleAt(state, 3);
  assert.equal(allSelected(state), false);
  assert.equal(state.selected.has("antigravity"), false);
});

test("selecting every tool individually selects All", () => {
  let state = createSelectionState();
  for (let index = 1; index <= 5; index += 1) state = toggleAt(state, index);
  assert.equal(allSelected(state), true);

  const rendered = renderSelector(state, "0.1.57");
  assert.match(rendered.text, /  \[x\] All\n\n  \[x\] Codex/);
});

test("arrow, toggle, confirm, and empty-confirm events update state", () => {
  let state = createSelectionState();
  let result = applySelectorEvent(state, { type: "confirm" });
  assert.match(result.state.message, /Select at least one/);

  result = applySelectorEvent(result.state, { type: "down" });
  state = result.state;
  assert.equal(state.cursor, 1);
  state = applySelectorEvent(state, { type: "toggle" }).state;
  assert.deepEqual([...state.selected], ["codex"]);
  assert.equal(applySelectorEvent(state, { type: "confirm" }).action, "confirm");
});

test("mouse clicks toggle only selectable rows", () => {
  const initial = createSelectionState();
  const rendered = renderSelector(initial, "0.1.57");
  const claudeRow = [...rendered.rows].find(([, index]) => index === 2)[0];

  const clicked = applySelectorEvent(initial, { type: "mouse", x: 4, y: claudeRow }, rendered.rows);
  assert.equal(clicked.state.selected.has("claude"), true);

  const ignored = applySelectorEvent(clicked.state, { type: "mouse", x: 4, y: 999 }, rendered.rows);
  assert.equal(ignored.state, clicked.state);
});

test("parses keyboard and split mouse sequences", () => {
  const keys = parseTerminalInput("\u001b[A\u001b[B \r\u0003");
  assert.deepEqual(keys.events.map((event) => event.type), [
    "up",
    "down",
    "toggle",
    "confirm",
    "cancel",
  ]);

  const first = parseTerminalInput("\u001b[<0;5;");
  assert.equal(first.events.length, 0);
  assert.equal(first.remainder, "\u001b[<0;5;");
  const second = parseTerminalInput(`${first.remainder}12M`);
  assert.deepEqual(second.events, [{ type: "mouse", x: 5, y: 12 }]);
  assert.equal(second.remainder, "");
});

test("ignores mouse release, wheel, and non-primary buttons", () => {
  const parsed = parseTerminalInput("\u001b[<0;1;1m\u001b[<64;1;1M\u001b[<2;1;1M");
  assert.deepEqual(parsed.events, []);
});

test("interactive runner restores terminal state after confirmation", async () => {
  class FakeInput extends EventEmitter {
    isTTY = true;
    isRaw = false;
    rawModes = [];
    setRawMode(value) {
      this.isRaw = value;
      this.rawModes.push(value);
    }
    resume() {}
    pause() {}
  }
  class FakeOutput {
    isTTY = true;
    writes = [];
    write(value) {
      this.writes.push(value);
    }
  }

  const input = new FakeInput();
  const output = new FakeOutput();
  const signals = new EventEmitter();
  const selection = runSelector({ version: "0.1.57", input, output, signals });
  input.emit("data", " ");
  input.emit("data", "\r");

  assert.deepEqual(await selection, ["codex", "claude", "antigravity", "vscode", "cursor"]);
  assert.deepEqual(input.rawModes, [true, false]);
  assert.match(output.writes.join(""), /\u001b\[\?1000h/);
  assert.match(output.writes.join(""), /\u001b\[\?1000l/);
  assert.match(output.writes.join(""), /\u001b\[\?1049l/);
});
