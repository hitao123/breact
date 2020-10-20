let nextUnitWork = null;
let wipRoot = null
let currentRoot = null;
let deletions = null;
let wipFiber = null;
let hookIndex = null;

const isEvent = key => key.startsWith('on');
const isProperty = key => key !== 'children' && !isEvent(key);
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next);


export function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        alternate: currentRoot
    }

    deletions = [];
    nextUnitWork = wipRoot;
}

export function updateDom(dom, prevProps, nextProps) {

    // remove old event listeners
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(
            key =>
                !(key in nextProps) || isNew(prevProps, nextProps)(key)
        )
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.removeEventListener(eventType, prevProps[name])
        })

    // remove old properties
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = '';
        })

    // set new properties
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            dom[name] = nextProps[name];
        })

    // add event listeners
    Object.keys(prevProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
        const eventType = name
            .toLowerCase()
            .substring(2)
        dom.addEventListener(eventType, nextProps[name])
    })
}

export function createDom(fiber) {
    const dom = fiber.type === 'TEXT_ELEMENT'
        ? document.createTextNode('')
        : document.createElement(fiber.type);

    Object.keys(fiber.props)
        .filter(isProperty)
        .forEach(name => {
            dom[name] =  fiber.props[name];
        });

    return dom;
}

export function workLoop(deadline) {
    let shouldYield = false;

    while (nextUnitWork && !shouldYield) {
        nextUnitWork = performUnitOfWork(
            nextUnitWork
        );
        shouldYield = deadline.timeRemaining() < 1;
    }

    if (!nextUnitWork && wipRoot) {
        commitRoot();
    }

    requestIdleCallback(workLoop)
}

export function performUnitOfWork(fiber) {

    const isFunctionComponent = fiber.type instanceof Function;

    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }

    let index = 0;
    let prevSibling = null;

    const elements = fiber.props.children;

    // create new fiber
    while (index < elements.length) {
        const element = elements[index];
        const newFiber = {
            type: element.type,
            props: element.props,
            parent: fiber,
            dom: null
        }

        if (index === 0) {
            fiber.child = newFiber;
        } else {
            prevSibling.sibling = newFiber;
        }

        prevSibling = newFiber;
        index++;
    }

    if (fiber.child) {
        return fiber.child;
    }

    // return next unit of work
    let nextFiber = fiber;

    while(nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent;
    }
}

export function commitRoot() {
    deletions.forEach(commitWork);
    commitWork(wipRoot.child);
    wipRoot = null;
}

export function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom);
    } else {
        commitDeletion(fiber.child, domParent);
    }
}

export function commitWork(fiber) {
    if (!fiber) {
        return;
    }

    let domParentFiber = fiber.parent;
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom;
    if (fiber.effectTag === 'DELETION') {
        commitDeletion(fiber, domParent);
    } else if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
        domParent.appendChild(fiber.dom);
    } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
        updateDom(
            fiber.dom,
            fiber.alternate.props,
            fiber.props
        )
    }

    commitWork(fiber.child);
    commitWork(fiber.sibling);
}

export function updateFunctionComponent(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}

export function updateHostComponent(fiber) {
    // add dom node 
    if (!fiber.dom) {
        fiber.dom = createDom(fiber);
    }

    if (fiber.parent) {
        fiber.parent.dom && fiber.parent.dom.appendChild(fiber.dom);
    }

    const elements = fiber.props.children;
    reconcileChildren(fiber, elements)
}

export function reconcileChildren(wipRoot, elements) {
    let index = 0;
    let prevSibling = null;
    let oldFiber = wipRoot.alternate && wipRoot.alternate.child;

    while(
        index < elements.length ||
        oldFiber != null
    ) {
        const element = elements[index];
        let newFiber = null;
        // compare old fiber to element
        // 1. 如果两个 fiber 类型相同，保持 dom node 更新新 props
        // 2. 如果类型不同，有一个新元素，需要创建一个新节点
        // 3. 如果类型不同，存在老的fiber节点，需要移除
        // react 使用 key 可以更好的回收， 也更容易知道节点的摆放位置

        const sameType = oldFiber &&
                         element &&
                         element.type == oldFiber.type

        if (sameType) {
            // update props
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipRoot,
                alternate: oldFiber,
                effectTag: "UPDATE"
            }
        }

        if (element && !sameType) {
            // add this node
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipRoot,
                alternate: null,
                effectTag: "PLACEMENT"
            }
        }

        if (oldFiber && !sameType) {
            // delete the old fiber node
            oldFiber.effectTag = "DELETE"
            deletions.push(oldFiber);
        }

        if (index === 0) {
            wipRoot.child = newFiber;
        } else if (element) {
            prevSibling.sibling = newFiber;
        }

        prevSibling = newFiber;
        index++;
    }
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
        nextUnitWork = wipRoot
        deletions = []
    }

    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
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