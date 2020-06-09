import { createElement } from './BreactElement.js';
import { render } from './render.js';
import { useState } from './hooks.js';
export const Breact = {
  createElement,
  render,
  useState
}; // test-code will be remove when this lib published in npm

/** @jsx Breact.createElement */

const element = Breact.createElement("div", {
  className: "hello-breact"
}, Breact.createElement("h1", null, "hello"), Breact.createElement("div", null, "Breact !!!!"));
const container = document.getElementById("app");
Breact.render(element, container);