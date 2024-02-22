import { InputRange } from "../../src/index.js";
import { InputStyleClone } from "../../src/input-style-clone.js";

const textInput = document.getElementById("input") as HTMLTextAreaElement;
const startOffsetInput = document.getElementById("start") as HTMLInputElement;
const endOffsetInput = document.getElementById("end") as HTMLInputElement;

const rects: HTMLElement[] = [];

function drawBoundingRect(rect: DOMRect) {
  const el = document.createElement("span");
  el.style.position = "fixed";
  el.style.pointerEvents = "none";
  el.style.outline = `2px solid blue`;
  el.style.top = `${rect.top}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  document.body.appendChild(el);
  rects.push(el);
}

function drawRect(rect: DOMRect) {
  const el = document.createElement("span");
  el.style.position = "fixed";
  el.style.pointerEvents = "none";
  el.style.background = "red";
  el.style.opacity = "0.5";
  el.style.top = `${rect.top}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  document.body.appendChild(el);
  rects.push(el);
}

function clear() {
  let rect;
  while ((rect = rects.pop())) rect.remove();
}

function draw() {
  requestAnimationFrame(() => {
    clear();

    const range = new InputRange(
      textInput,
      parseInt(startOffsetInput.value, 10),
      parseInt(endOffsetInput.value, 10),
    );

    for (const rect of range.getClientRects()) drawRect(rect);

    drawBoundingRect(range.getBoundingClientRect());
  });
}

draw();

InputStyleClone.for(textInput).addEventListener("update", () => draw());
InputStyleClone.for(startOffsetInput).addEventListener("update", () => draw());
InputStyleClone.for(endOffsetInput).addEventListener("update", () => draw());
