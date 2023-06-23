import { createDom } from './BreactElement.js'

let nextUnitOfWork = null



function workLoop(deadline) {
    let shouldYield = false

    console.log('exec...')
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        shouldYield = deadline.timeRemaining() < 1
    }

    requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
    console.log(fiber)
    // add dom node
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }

    if (fiber.parent) {
        fiber.parent.dom.appendChild(fiber.dom)
    }

    // create new fibers
    const elements = fiber.props.children
    let index = 0
    let prevSibling = null

    console.log('elements', elements)
    while (index < elements.length) {
        const element = elements[index];

        let newFiber = {
            type: element.type,
            props: element.props,
            parent: fiber,
            dom: null,
        }

        if (index === 0) {
            fiber.child = newFiber
        } else {
            prevSibling.sibling = newFiber
        }
    
        prevSibling = newFiber
        index++
    }

    // return next unit of work
    if (fiber.child) {
        return fiber.child
    }

    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent 
    }
}


export function render(element, container) {

    nextUnitOfWork = {
        dom: container,
        props: {
            children: [element]
        }
    }


}
