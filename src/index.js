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
const element = (<div className="hello-breact">
    <div>hello</div>
    <div>Breact !!!!</div>
</div>);

const container = document.getElementById("app")
Breact.render(element, container)
