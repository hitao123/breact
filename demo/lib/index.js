import { createElement } from './BreactElement.js';
import { render, useState } from './render.js';
export const Breact = {
  createElement,
  render,
  useState
}; // test-code will be remove when this lib published in npm

/** @jsx Breact.createElement */

function App(props) {
  const [count, setCount] = useState(1);
  return Breact.createElement("div", {
    className: "hello-breact"
  }, Breact.createElement("h1", null, props.name), Breact.createElement("h2", null, Breact.createElement("p", null, "this is p"), Breact.createElement("a", {
    href: "https://openai.com",
    alt: "open"
  }, "link")), Breact.createElement("button", {
    onClick: () => setCount(c => c + 1)
  }, "Count: ", count));
}

const element = Breact.createElement(App, {
  name: "hello Breact!!"
});
const container = document.getElementById("app");
Breact.render(element, container);