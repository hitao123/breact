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

function App(props) {
  return Breact.createElement("div", {
    className: "hello-breact"
  }, Breact.createElement("h1", null, props.name), Breact.createElement("h2", null, Breact.createElement("p", null, "this is p"), Breact.createElement("a", {
    href: "https://openai.com",
    alt: "open"
  }, "link")), Breact.createElement("button", {
    onClick: () => console.log('click')
  }, "Click"));
}

const element = Breact.createElement(App, {
  name: "hello Breact!!"
});
const container = document.getElementById("app");
Breact.render(element, container);