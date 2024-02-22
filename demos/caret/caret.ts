import { InputRange } from "../../src/index.js";
import {InputStyleClone} from "../../src/input-style-clone.js";

const inputs = document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(".caret-input");

const INDICATOR_SIZE = 6;

const indicator = document.createElement("span");
indicator.style.position = "fixed";
indicator.style.backgroundColor = "red";
indicator.style.width = `${INDICATOR_SIZE}px`;
indicator.style.height = `${INDICATOR_SIZE}px`;
indicator.style.transform = "rotate(45deg)";
indicator.style.pointerEvents = "none";
indicator.style.display = "none";
document.body.appendChild(indicator);

function hideIndicator() {
  indicator.style.display = "none";
}

function updateIndicator() {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement)) {
    hideIndicator();
    return;
  }

  const range = InputRange.fromSelection(focused);
  if (!range.collapsed) {
    // user has text selected
    hideIndicator();
    return;
  }

  const rect = range.getBoundingClientRect();
  indicator.style.display = "block";
  indicator.style.top = `${rect.top + rect.height}px`;
  indicator.style.left = `${rect.left - INDICATOR_SIZE / 2}px`;
}

for (const input of inputs) {
  InputStyleClone.for(input).addEventListener('update', updateIndicator)
}
