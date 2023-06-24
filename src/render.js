import { createDom, updateDom } from './BreactElement.js'

let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = []
let hookIndex = null
let wipFiber = null

function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
    } else {
        commitDeletion(fiber.child, domParent)
    }
}

function commitWork(fiber) {
    if (!fiber) {
        return
    }
    
    let domParentFiber = fiber.parent
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom

    if (fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
        domParent.appendChild(fiber.dom)
    } else if (fiber.effectTag === 'UPDATE' && fiber.dom !== null) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    } else if (fiber.effectTag === 'DELETION') {
        commitDeletion(fiber, domParent)
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function commitRoot() {
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}

function workLoop(deadline) {
    let shouldYield = false

    console.log('exec...')
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        shouldYield = deadline.timeRemaining() < 1
    }

    // nextUnitOfWork 为空，当前 wipRoot 不为空
    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    requestIdleCallback(workLoop)
}
// https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback
// https://caniuse.com/#search=requestIdleCallback
// 在浏览器的空闲时段内调用的函数排队。这使开发者能够在主事件循环上执行后台和低优先级工作，
// 而不会影响延迟关键事件，如动画和输入响应。函数一般会按先进先调用的顺序执行，然而，
// 如果回调函数指定了执行超时时间timeout，则有可能为了在超时前执行函数而打乱执行顺序

// requestIdleCallback(callback)  callback 会接受一个 IdleDeadline 参数
// IdleDeadline.timeRemaining()
// 并且是浮点类型的数值，它用来表示当前闲置周期的预估剩余毫秒数。如果idle period已经结束，
// 则它的值是0。你的回调函数(传给requestIdleCallback的函数)可以重复的访问这个属性用来判断
// 当前线程的闲置时间是否可以在结束前执行更多的任务。 timeRemaining
requestIdleCallback(workLoop)


function reconcileChildren(wipFiber, elements) {
    let index = 0
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child
    let prevSibling = null
    // compare old fiber to element
    // 1. 如果两个 fiber 类型相同，保持 dom node 更新新 props
    // 2. 如果类型不同，有一个新元素，需要创建一个新节点
    // 3. 如果类型不同，存在老的fiber节点，需要移除
    // react 使用 key 可以更好的回收， 也更容易知道节点的摆放位置
    // console.log('elements', elements)
    while (index < elements.length || oldFiber != null) {
        const element = elements[index];
        let newFiber = null

        const sameType =
            oldFiber &&
            element &&
            element.type == oldFiber.type

        if (sameType) {
            // update the node
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: "UPDATE",
            }
        }
        if (element && !sameType) {
            // add this node
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: "PLACEMENT",
            }
        }
        if (oldFiber && !sameType) {
            // delete the oldFiber's node
            oldFiber.effectTag = "DELETION"
            deletions.push(oldFiber)
        }

        if (oldFiber) {
            oldFiber = oldFiber.sibling
        }

        if (index === 0) {
            wipFiber.child = newFiber
        } else if (element) {
            prevSibling.sibling = newFiber
        }

        prevSibling = newFiber
        index++
    }
}

function updateFunctionComponent(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []

    const children = [fiber.type(fiber.props)]
    console.log(fiber, '??===++', children)
    reconcileChildren(fiber, children)
}

function updateHostComponent(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
    reconcileChildren(fiber, fiber.props.children)
}


function performUnitOfWork(fiber) {
    console.log(fiber)
    const isFunctionComponent =
        fiber.type instanceof Function
    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
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

    wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        alternate: currentRoot // 指向原来的老节点
    }

    nextUnitOfWork = wipRoot

}


export function useState(initial) {
    const oldHook =
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex];

    const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: [],
    }

    const actions = oldHook ? oldHook.queue : []
    actions.forEach(action => {
        hook.state = action(hook.state)
    })

    const setState = action => {
        hook.queue.push(action)
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot,
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }

    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
}
