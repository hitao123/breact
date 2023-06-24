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
function App(props) {
    return <div className="hello-breact">
        <h1>{ props.name }</h1>
        <h2>
            <p>this is p</p>
            <a href="https://openai.com" alt="open">link</a>
        </h2>
        <button onClick={() => console.log('click')}>Click</button>
    </div>
}
const element = <App name="hello Breact!!" />;

const container = document.getElementById("app")
Breact.render(element, container)
