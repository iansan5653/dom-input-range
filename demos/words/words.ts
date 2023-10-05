import { InputRange } from "../../src/index.js";

const inputs = document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(".words-input");

function createHighlight(rect: DOMRect) {
  const el = document.createElement("span");
  el.classList.add("words-highlight");
  el.style.position = "fixed";
  el.style.backgroundColor = "red";
  el.style.opacity = "0.5";
  el.style.pointerEvents = "none";
  el.style.top = `${rect.top}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  document.body.appendChild(el);
  return el;
}

const words = ["apple", "banana", "grape"];

let highlights: HTMLElement[] = [];

function clearHighlights() {
  for (const highlight of highlights) {
    highlight.remove();
  }
  highlights = [];
}

function createHighlights() {
  for (const input of inputs) {
    const wordsRegex = new RegExp(words.join("|"), "g");

    let result: RegExpExecArray | null;
    while ((result = wordsRegex.exec(input.value))) {
      const range = new InputRange(input, result.index, result.index + result[0].length);

      for (const rect of range.getClientRects()) {
        highlights.push(createHighlight(rect));
      }
    }
  }
}

createHighlights();

for (const input of inputs)
  input.addEventListener("input", () => {
    // use a timeout to let the input change first
    setTimeout(() => {
      clearHighlights();
      createHighlights();
    });
  });
