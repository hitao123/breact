import {createElement} from './BreactElement.js'
import {render} from './render.js'
import {useState} from './hooks.js'

export const Breact = {
    createElement,
    render,
    useState
}


// test-code will be remove when this lib published in npm
/** @jsx Breact.createElement */
const element = (
    <div className="hello-breact">
        <h1>hello</h1>
        <div>Breact !!!!</div>
    </div>
);

const container = document.getElementById("app")
Breact.render(element, container)
