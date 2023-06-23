import { createElement } from './BreactElement.js';
import { render } from './render.js';
import { useState } from './hooks.js';
const Breact = {
  createElement,
  render,
  useState
};
export default Breact; // test-code will be remove when this lib published in npm

/** @jsx Breact.createElement */

const element = Breact.createElement("div", {
  className: "hello-breact"
}, Breact.createElement("h1", null, "hello Breact !!!!"), Breact.createElement("h2", null, Breact.createElement("p", null, "this is p"), Breact.createElement("a", {
  href: "https://openai.com",
  alt: "open"
}, "link")));
const container = document.getElementById("app");
Breact.render(element, container);