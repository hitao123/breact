import {createElement} from './BreactElement.js'
import {render} from './render.js'
import {useState} from './hooks.js'

const Breact = {
    createElement,
    render,
    useState
}


export default Breact;


// test-code will be remove when this lib published in npm
/** @jsx Breact.createElement */
const element = (
<div className="hello-breact">
    <h1>hello Breact !!!!</h1>
    <h2>
        <p>this is p</p>
        <a href="https://openai.com" alt="open">link</a>
    </h2>
</div>);

const container = document.getElementById("app")
Breact.render(element, container)
