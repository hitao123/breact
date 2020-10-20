import { createElement } from './BreactElement.js';
import { render, useState } from './render.js';
export const Breact = {
  createElement,
  render,
  useState
}; // test-code will be remove when this lib published in npm

/** @jsx Breact.createElement */

function Counter() {
  const [state, setState] = useState(1);
  return Breact.createElement("h1", {
    onClick: () => setState(c => c + 1)
  }, "Count: ", state);
}

const element = Breact.createElement(Counter, null);
const container = document.getElementById("app");
Breact.render(element, container);