import { createElement } from './BreactElement.js'
import { render, useState } from './render.js'

export const Breact = {
    createElement,
    render,
    useState
}


// test-code will be remove when this lib published in npm
/** @jsx Breact.createElement */
function App(props) {

    const [count, setCount] = useState(1)
    return <div className="hello-breact">
        <h1>{ props.name }</h1>
        <h2>
            <p>this is p</p>
            <a href="https://openai.com" alt="open">link</a>
        </h2>
        <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
}
const element = <App name="hello Breact!!" />;

const container = document.getElementById("app")
Breact.render(element, container)
