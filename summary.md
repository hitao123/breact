# Didact (React 简化版) 执行流程分析

## 目录
- [整体架构概览](#整体架构概览)
- [核心流程分析](#核心流程分析)
- [Fiber 节点结构](#fiber-节点结构)
- [复杂示例演示](#复杂示例演示)
- [performUnitOfWork 详解](#performunitofwork-详解)
- [完整执行序列](#完整执行序列)
- [关键点总结](#关键点总结)

---

## 整体架构概览

Didact 实现了一个迷你 React，包含三个核心部分：

1. **虚拟 DOM 创建**（`createElement`）
2. **Fiber 架构 + 调度**（可中断的渲染）
3. **DOM 更新**（`updateDom` + Commit 阶段）

---

## 核心流程分析

### 1. 触发更新的起点

```javascript
// 初始渲染
Didact.render(element, container)

// 或者 setState 触发更新
setState(action => newState)
```

### 2. Fiber 调度流程（重点）

```
render/setState 
  ↓
设置 wipRoot (work in progress root)
  ↓
nextUnitOfWork = wipRoot
  ↓
workLoop 在浏览器空闲时执行
  ↓
performUnitOfWork 逐个处理 fiber 节点
  ↓
所有 fiber 处理完毕
  ↓
commitRoot 统一提交 DOM 变更
```

#### 关键代码：

```javascript
function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1  // 时间不足就让出控制权
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()  // 所有 fiber 处理完，统一提交
  }

  requestIdleCallback(workLoop)  // 继续下一轮
}
```

**为什么这样设计？**
- `performUnitOfWork` 每次只处理一个 fiber 节点
- 检查 `deadline.timeRemaining()` 如果浏览器需要渲染，就暂停
- 下次空闲时继续，不会阻塞用户交互和动画

### 3. updateDom 详解

`updateDom` 负责**对比新旧 props**，只更新变化的部分：

```javascript
function updateDom(dom, prevProps, nextProps) {
  // 第一步：移除旧的或变化的事件监听器
  Object.keys(prevProps)
    .filter(isEvent)  // 过滤 onXxx 属性
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)  // onClick → click
      dom.removeEventListener(eventType, prevProps[name])
    })

  // 第二步：移除旧属性
  Object.keys(prevProps)
    .filter(isProperty)  // 非 children 且非事件
    .filter(isGone(prevProps, nextProps))  // 新 props 中不存在
    .forEach(name => {
      dom[name] = ""
    })

  // 第三步：设置新的或变化的属性
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))  // prev[key] !== next[key]
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // 第四步：添加新的事件监听器
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}
```

#### 举例说明：

```javascript
// 第一次渲染
<h1 className="title" onClick={handler1}>Hello</h1>
// prevProps = {}
// nextProps = { className: "title", onClick: handler1, children: [...] }
// 执行：设置 className，添加 click 监听

// 第二次更新
<h1 className="title active" onClick={handler2}>World</h1>
// prevProps = { className: "title", onClick: handler1 }
// nextProps = { className: "title active", onClick: handler2 }
// 执行：
//   1. 移除 handler1（因为 onClick 变了）
//   2. 更新 className（"title" → "title active"）
//   3. 添加 handler2
```

### 4. Commit 阶段（统一提交）

```javascript
function commitRoot() {
  deletions.forEach(commitWork)  // 先处理删除
  commitWork(wipRoot.child)       // 递归处理所有节点
  currentRoot = wipRoot           // 切换 root
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) return

  // 找到有真实 DOM 的父节点（函数组件没有 dom）
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom)  // 新增
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)  // 更新
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent)  // 删除
  }

  commitWork(fiber.child)    // 递归子节点
  commitWork(fiber.sibling)  // 递归兄弟节点
}
```

---

## Fiber 节点结构

一个 fiber 节点包含这些关键属性：

```javascript
{
  type: "div" | Function,           // DOM 类型或函数组件
  props: { children: [...], ... },  // 属性
  dom: DOMNode | null,              // 真实 DOM 引用
  parent: fiber,                    // 父 fiber
  child: fiber,                     // 第一个子 fiber
  sibling: fiber,                   // 下一个兄弟 fiber
  alternate: fiber,                 // 上一次渲染的 fiber（用于对比）
  effectTag: "PLACEMENT" | "UPDATE" | "DELETION", // 操作类型
  hooks: []                         // 函数组件的 hooks
}
```

---

## 复杂示例演示

假设我们渲染这样一个组件树：

```jsx
function App() {
  const [count, setCount] = useState(0)
  return (
    <div className="app">
      <Header title="My App" />
      <Content count={count} />
      <footer>
        <button onClick={() => setCount(count + 1)}>+1</button>
      </footer>
    </div>
  )
}

function Header({ title }) {
  return <h1>{title}</h1>
}

function Content({ count }) {
  return (
    <main>
      <p>Count: {count}</p>
    </main>
  )
}
```

### Fiber 树结构

```
                    wipRoot (container)
                         |
                       child
                         ↓
                    App (函数组件)
                         |
                       child
                         ↓
                    div.app ────sibling→ (null)
                         |
                       child
                         ↓
                     Header ────sibling→ Content ────sibling→ footer
                         |                   |                    |
                       child               child                child
                         ↓                   ↓                    ↓
                        h1                 main                button
                         |                   |                    |
                       child               child                child
                         ↓                   ↓                    ↓
                  "My App"(text)            p                 "+1"(text)
                                             |
                                           child
                                             ↓
                                      "Count: 0"(text)
```

---

## performUnitOfWork 详解

```javascript
function performUnitOfWork(fiber) {
  // 步骤 1: 处理当前 fiber
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)  // 执行函数，生成 children
  } else {
    updateHostComponent(fiber)      // 创建 DOM，准备 children
  }
  
  // 步骤 2: 返回下一个要处理的 fiber（DFS 遍历）
  if (fiber.child) {
    return fiber.child              // 优先返回子节点
  }
  
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling      // 没有子节点，返回兄弟节点
    }
    nextFiber = nextFiber.parent    // 没有兄弟，返回父节点继续找
  }
  
  return null  // 遍历完成
}
```

---

## 完整执行序列

### **第 1 次：处理 wipRoot**

```javascript
fiber = {
  type: undefined,
  dom: <div id="root">,
  props: { children: [<App />] },
  child: null  // 即将创建
}
```

- 执行 `updateHostComponent`
- 调用 `reconcileChildren`，创建 child: `App fiber`
- **返回**: `App fiber`

---

### **第 2 次：处理 App（函数组件）**

```javascript
fiber = {
  type: App,  // Function
  props: {},
  parent: wipRoot
}
```

- 执行 `updateFunctionComponent(fiber)`
  - 设置 `wipFiber = fiber`, `hookIndex = 0`
  - 执行 `App(fiber.props)` → 返回 `<div className="app">...</div>`
  - 调用 `reconcileChildren`，创建 child: `div.app fiber`
- **返回**: `div.app fiber`

---

### **第 3 次：处理 div.app**

```javascript
fiber = {
  type: "div",
  props: { className: "app", children: [Header, Content, footer] },
  parent: App fiber
}
```

- 执行 `updateHostComponent`
  - 创建 `fiber.dom = <div>`
  - 调用 `reconcileChildren`，创建三个子节点：
    - `Header fiber` (child)
    - `Content fiber` (Header 的 sibling)
    - `footer fiber` (Content 的 sibling)
- **返回**: `Header fiber`

---

### **第 4 次：处理 Header（函数组件）**

```javascript
fiber = {
  type: Header,  // Function
  props: { title: "My App" },
  parent: div.app fiber,
  sibling: Content fiber
}
```

- 执行 `updateFunctionComponent`
  - 执行 `Header({ title: "My App" })` → 返回 `<h1>My App</h1>`
  - 创建 child: `h1 fiber`
- **返回**: `h1 fiber`

---

### **第 5 次：处理 h1**

```javascript
fiber = {
  type: "h1",
  props: { children: ["My App"] },
  parent: Header fiber
}
```

- 创建 `fiber.dom = <h1>`
- 创建 child: `"My App" text fiber`
- **返回**: `"My App" text fiber`

---

### **第 6 次：处理 "My App" 文本节点**

```javascript
fiber = {
  type: "TEXT_ELEMENT",
  props: { nodeValue: "My App", children: [] },
  parent: h1 fiber
}
```

- 创建 `fiber.dom = TextNode`
- `reconcileChildren(fiber, [])` → 无子节点
- **检查返回逻辑**:
  - ❌ `fiber.child` 不存在
  - ❌ `fiber.sibling` 不存在
  - 回到 `fiber.parent` (h1)
    - ❌ `h1.sibling` 不存在
    - 回到 `h1.parent` (Header)
      - ✅ `Header.sibling` 存在！
- **返回**: `Content fiber`

---

### **第 7 次：处理 Content（函数组件）**

```javascript
fiber = {
  type: Content,
  props: { count: 0 },
  parent: div.app fiber,
  sibling: footer fiber
}
```

- 执行 `Content({ count: 0 })` → 返回 `<main><p>Count: 0</p></main>`
- 创建 child: `main fiber`
- **返回**: `main fiber`

---

### **第 8 次：处理 main**

```javascript
fiber = {
  type: "main",
  props: { children: [<p>] },
  parent: Content fiber
}
```

- 创建 `fiber.dom = <main>`
- 创建 child: `p fiber`
- **返回**: `p fiber`

---

### **第 9 次：处理 p**

```javascript
fiber = {
  type: "p",
  props: { children: ["Count: 0"] },
  parent: main fiber
}
```

- 创建 `fiber.dom = <p>`
- 创建 child: `"Count: 0" text fiber`
- **返回**: `"Count: 0" text fiber`

---

### **第 10 次：处理 "Count: 0" 文本节点**

```javascript
fiber = {
  type: "TEXT_ELEMENT",
  props: { nodeValue: "Count: 0", children: [] },
  parent: p fiber
}
```

- 创建 TextNode
- 无子节点，无兄弟节点
- 向上回溯：p → main → Content
- ✅ `Content.sibling` 存在
- **返回**: `footer fiber`

---

### **第 11 次：处理 footer**

```javascript
fiber = {
  type: "footer",
  props: { children: [<button>] },
  parent: div.app fiber,
  sibling: null  // 最后一个兄弟
}
```

- 创建 `fiber.dom = <footer>`
- 创建 child: `button fiber`
- **返回**: `button fiber`

---

### **第 12 次：处理 button**

```javascript
fiber = {
  type: "button",
  props: { 
    onClick: handler,
    children: ["+1"]
  },
  parent: footer fiber
}
```

- 创建 `fiber.dom = <button>`
- 创建 child: `"+1" text fiber`
- **返回**: `"+1" text fiber`

---

### **第 13 次：处理 "+1" 文本节点**

```javascript
fiber = {
  type: "TEXT_ELEMENT",
  props: { nodeValue: "+1", children: [] },
  parent: button fiber
}
```

- 创建 TextNode
- 无子节点，无兄弟节点
- 向上回溯：button → footer → div.app → App → wipRoot
- 所有节点都没有 sibling 了
- **返回**: `null`  ← **遍历完成！**

---

### **第 14 次：workLoop 检测**

```javascript
if (!nextUnitOfWork && wipRoot) {
  commitRoot()  // 触发 commit 阶段
}
```

---

## 关键点总结

### 1. DFS 遍历顺序

```
wipRoot → App → div.app → Header → h1 → "My App" 
                        ↓ (回溯到 Header.sibling)
                      Content → main → p → "Count: 0"
                        ↓ (回溯到 Content.sibling)
                      footer → button → "+1"
                        ↓
                      null (完成)
```

### 2. 两种组件的处理差异

#### 函数组件 (`updateFunctionComponent`)

```javascript
// 没有真实 DOM
fiber.dom = null

// 执行函数获取 children
const children = [fiber.type(fiber.props)]

// 例如：Header(props) → <h1>...</h1>
reconcileChildren(fiber, children)
```

#### 原生元素 (`updateHostComponent`)

```javascript
// 创建真实 DOM
fiber.dom = document.createElement(fiber.type)

// children 已经在 props 中
reconcileChildren(fiber, fiber.props.children)
```

### 3. reconcileChildren 的作用

在每次 `performUnitOfWork` 中被调用，负责：
- 对比 `wipFiber.alternate.child`（旧 fiber）和 `elements`（新虚拟 DOM）
- 标记 `effectTag`: `PLACEMENT`（新增）/ `UPDATE`（更新）/ `DELETION`（删除）
- 构建 `child` 和 `sibling` 链表

```javascript
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber = null

    const sameType = 
      oldFiber && element && element.type == oldFiber.type

    if (sameType) {
      // 类型相同 → 复用 DOM，标记 UPDATE
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,        // 复用旧 DOM
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    if (element && !sameType) {
      // 新增元素 → 标记 PLACEMENT
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,                // 需要创建新 DOM
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }
    if (oldFiber && !sameType) {
      // 旧元素不存在了 → 标记 DELETION
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    // 构建 fiber 树结构
    if (index === 0) {
      wipFiber.child = newFiber      // 第一个子节点
    } else if (element) {
      prevSibling.sibling = newFiber // 兄弟节点链表
    }

    prevSibling = newFiber
    index++
  }
}
```

### 4. 完整流程图

```
用户点击 Counter
  ↓
setState(c => c + 1) 被调用
  ↓
创建新的 wipRoot，标记需要更新
  ↓
requestIdleCallback 调度 workLoop
  ↓
performUnitOfWork 逐个处理 fiber：
  - updateFunctionComponent (Counter)
  - reconcileChildren (对比新旧 children)
  - 标记 effectTag: UPDATE/PLACEMENT/DELETION
  ↓
所有 fiber 处理完毕
  ↓
commitRoot 统一提交：
  - commitWork 遍历所有 fiber
  - 根据 effectTag 调用 updateDom
  - updateDom 对比 props，只更新变化部分
  ↓
DOM 更新完成，页面显示新的 Count
```

### 5. 核心设计思想

1. **双缓冲**：`currentRoot` 和 `wipRoot` 交替，确保渲染过程可中断
2. **Fiber 链表**：通过 `child`、`sibling`、`parent` 构建可遍历的树
3. **两阶段提交**：
   - **Render 阶段**：可中断，只标记变更（`effectTag`）
   - **Commit 阶段**：不可中断，统一操作真实 DOM
4. **增量更新**：`updateDom` 通过对比 props，避免不必要的 DOM 操作

### 6. 为什么这样设计？

- **可中断**: 每次只处理一个 fiber，处理完返回下一个
- **增量渲染**: 通过 `deadline.timeRemaining()` 控制，避免长时间阻塞
- **统一提交**: Render 阶段只标记变更，Commit 阶段统一操作 DOM

这样的设计使得即使有大量 DOM 更新，也不会阻塞浏览器的渲染和用户交互，这就是 **React Fiber 架构的核心价值**！

---

## Hooks 原理深度解析

### Hooks 的核心概念

Hooks 是函数组件的"记忆系统"，让函数组件能够：
- 保存状态（useState）
- 记住上一次的值
- 在重新渲染时保持状态不丢失

### useState 的完整实现

```javascript
let wipFiber = null    // 当前正在处理的函数组件 fiber
let hookIndex = null   // 当前 hook 的索引

function updateFunctionComponent(fiber) {
  wipFiber = fiber        // 设置全局变量，指向当前组件
  hookIndex = 0           // 重置 hook 索引
  wipFiber.hooks = []     // 初始化 hooks 数组
  
  const children = [fiber.type(fiber.props)]  // 执行组件函数
  reconcileChildren(fiber, children)
}

function useState(initial) {
  // 步骤 1: 从旧 fiber 中获取对应位置的 hook
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  
  // 步骤 2: 创建新 hook
  const hook = {
    state: oldHook ? oldHook.state : initial,  // 复用旧状态或使用初始值
    queue: [],                                  // 存放待执行的 action
  }

  // 步骤 3: 执行所有待处理的 action
  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action(hook.state)  // action 是函数：oldState => newState
  })

  // 步骤 4: 创建 setState 函数
  const setState = action => {
    hook.queue.push(action)  // 将 action 添加到队列
    
    // 触发重新渲染
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }

  // 步骤 5: 保存 hook 并递增索引
  wipFiber.hooks.push(hook)
  hookIndex++
  
  return [hook.state, setState]
}
```

### Hooks 的工作流程

#### 场景：Counter 组件的完整生命周期

```jsx
function Counter() {
  const [count, setCount] = useState(1)
  const [name, setName] = useState("React")
  
  return (
    <div>
      <h1>{name}: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  )
}
```

#### 第一次渲染（初始化）

**执行 `updateFunctionComponent(fiber)`**

```javascript
wipFiber = Counter fiber
hookIndex = 0
wipFiber.hooks = []

// 开始执行 Counter() 函数
```

**第 1 个 useState 调用**

```javascript
// useState(1)
const oldHook = undefined  // 第一次渲染，没有旧 hook

const hook = {
  state: 1,      // 使用初始值
  queue: []
}

const actions = []  // 没有待处理的 action

const setState = action => { ... }

wipFiber.hooks.push(hook)  // wipFiber.hooks = [{ state: 1, queue: [] }]
hookIndex++                 // hookIndex = 1

return [1, setState]        // count = 1
```

**第 2 个 useState 调用**

```javascript
// useState("React")
const oldHook = undefined

const hook = {
  state: "React",
  queue: []
}

wipFiber.hooks.push(hook)  // wipFiber.hooks = [
                           //   { state: 1, queue: [] },
                           //   { state: "React", queue: [] }
                           // ]
hookIndex++                 // hookIndex = 2

return ["React", setState]  // name = "React"
```

**第一次渲染后的状态**

```javascript
Counter fiber = {
  type: Counter,
  hooks: [
    { state: 1, queue: [] },         // count
    { state: "React", queue: [] }    // name
  ],
  // ...
}
```

#### 用户点击按钮（触发更新）

**执行 `setCount(c => c + 1)`**

```javascript
// setState 被调用
action => {
  hook.queue.push(c => c + 1)  // 将 action 加入队列
  
  // hook.queue = [c => c + 1]
  
  // 触发重新渲染
  wipRoot = {
    dom: currentRoot.dom,
    props: currentRoot.props,
    alternate: currentRoot,  // 指向旧的 fiber 树
  }
  nextUnitOfWork = wipRoot
  deletions = []
}

// requestIdleCallback 会在下一帧调用 workLoop
```

#### 第二次渲染（更新）

**执行 `updateFunctionComponent(fiber)`**

```javascript
wipFiber = Counter fiber (新的)
hookIndex = 0
wipFiber.hooks = []

// 重要：wipFiber.alternate 指向上一次渲染的 fiber
// wipFiber.alternate.hooks = [
//   { state: 1, queue: [c => c + 1] },
//   { state: "React", queue: [] }
// ]
```

**第 1 个 useState 调用**

```javascript
// useState(1)
const oldHook = wipFiber.alternate.hooks[0]
// oldHook = { state: 1, queue: [c => c + 1] }

const hook = {
  state: 1,      // 先复制旧状态
  queue: []      // 新的队列（空）
}

// 执行所有待处理的 action
const actions = [c => c + 1]  // 从 oldHook.queue 获取
actions.forEach(action => {
  hook.state = action(hook.state)  // hook.state = (c => c + 1)(1) = 2
})

// hook.state 现在是 2

wipFiber.hooks.push(hook)  // wipFiber.hooks = [{ state: 2, queue: [] }]
hookIndex++                 // hookIndex = 1

return [2, setState]        // count = 2 ✅ 状态更新了！
```

**第 2 个 useState 调用**

```javascript
// useState("React")
const oldHook = wipFiber.alternate.hooks[1]
// oldHook = { state: "React", queue: [] }

const hook = {
  state: "React",  // 没有变化
  queue: []
}

const actions = []  // 队列为空，没有 action 需要执行

wipFiber.hooks.push(hook)  // wipFiber.hooks = [
                           //   { state: 2, queue: [] },
                           //   { state: "React", queue: [] }
                           // ]
hookIndex++                 // hookIndex = 2

return ["React", setState]  // name = "React"
```

**第二次渲染后的状态**

```javascript
currentRoot = {
  type: Counter,
  hooks: [
    { state: 2, queue: [] },         // count 已更新
    { state: "React", queue: [] }    // name 未变
  ],
  // ...
}
```

### 关键设计要点

#### 1. 为什么 Hooks 必须按顺序调用？

因为 Hooks 依赖**数组索引**来匹配新旧状态：

```javascript
// ✅ 正确：每次渲染调用顺序相同
function Counter() {
  const [count, setCount] = useState(1)    // hooks[0]
  const [name, setName] = useState("React") // hooks[1]
  return ...
}

// ❌ 错误：条件调用会导致索引错乱
function Counter() {
  if (someCondition) {
    const [count, setCount] = useState(1)  // 有时是 hooks[0]，有时不存在
  }
  const [name, setName] = useState("React") // 有时是 hooks[0]，有时是 hooks[1]
  return ...
}
```

**索引错乱的后果：**

```javascript
// 第一次渲染（someCondition = true）
hooks = [
  { state: 1, queue: [] },      // count - hooks[0]
  { state: "React", queue: [] } // name - hooks[1]
]

// 第二次渲染（someCondition = false）
hooks = [
  { state: "React", queue: [] } // name - hooks[0] ❌ 错误地使用了 count 的旧状态
]
```

#### 2. 为什么 setState 是异步的？

```javascript
const setState = action => {
  hook.queue.push(action)  // 只是加入队列，不立即执行
  
  // 触发重新渲染
  wipRoot = { ... }
  nextUnitOfWork = wipRoot
}
```

**好处：**
- **批量更新**：多次 setState 只触发一次渲染
- **性能优化**：避免频繁操作 DOM

```javascript
// 用户连续点击三次按钮
setCount(c => c + 1)  // hook.queue = [c => c + 1]
setCount(c => c + 1)  // hook.queue = [c => c + 1, c => c + 1]
setCount(c => c + 1)  // hook.queue = [c => c + 1, c => c + 1, c => c + 1]

// 下一次渲染时，一次性执行所有 action
// 1 -> 2 -> 3 -> 4
```

#### 3. 为什么使用函数式更新？

```javascript
// ✅ 推荐：函数式更新
setCount(c => c + 1)

// ❌ 不推荐：直接传值（Didact 不支持）
setCount(count + 1)
```

**函数式更新的优势：**

```javascript
// 连续调用
setCount(c => c + 1)  // c = 1 -> 2
setCount(c => c + 1)  // c = 2 -> 3
setCount(c => c + 1)  // c = 3 -> 4

// 如果使用直接传值（假设支持）
setCount(count + 1)  // count = 1，设置为 2
setCount(count + 1)  // count 还是 1，设置为 2 ❌
setCount(count + 1)  // count 还是 1，设置为 2 ❌
```

### Hooks 与 Fiber 的关系

```
Counter fiber
  |
  ├─ type: Counter (函数)
  ├─ hooks: [                    ← 存储所有 hook 状态
  |    { state: 2, queue: [] },
  |    { state: "React", queue: [] }
  |  ]
  ├─ alternate: 旧 Counter fiber  ← 用于对比状态
  └─ child: div fiber
```

**关键点：**
1. 每个函数组件 fiber 都有自己的 `hooks` 数组
2. `alternate` 保存上一次的 fiber，包含旧的 hooks
3. `hookIndex` 确保每次渲染时 hooks 的顺序一致

### 多个组件同时使用 Hooks

```jsx
function App() {
  const [appCount, setAppCount] = useState(0)
  return (
    <div>
      <Counter />
      <Counter />
    </div>
  )
}

function Counter() {
  const [count, setCount] = useState(1)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**Fiber 树结构：**

```
App fiber
  hooks: [{ state: 0, queue: [] }]  // appCount
  |
  └─ div fiber
      |
      ├─ Counter fiber (第1个)
      |   hooks: [{ state: 1, queue: [] }]  // 独立的 count
      |
      └─ Counter fiber (第2个)
          hooks: [{ state: 1, queue: [] }]  // 独立的 count
```

**重要：每个组件实例的 hooks 是相互独立的！**

### useState 执行时序图

```
用户点击按钮
  ↓
setCount(c => c + 1)
  ↓
action 加入 hook.queue
  ↓
触发重新渲染（设置 wipRoot）
  ↓
requestIdleCallback 调度
  ↓
performUnitOfWork(Counter fiber)
  ↓
updateFunctionComponent
  ↓
wipFiber = Counter fiber
hookIndex = 0
wipFiber.hooks = []
  ↓
执行 Counter() 函数
  ↓
调用 useState(1)
  ↓
获取 oldHook（包含 queue）
  ↓
执行 queue 中的所有 action
  ↓
hook.state = 2
  ↓
返回 [2, setState]
  ↓
组件使用新的 count = 2 渲染
  ↓
reconcileChildren 对比新旧 children
  ↓
commitRoot 更新 DOM
  ↓
页面显示新的值
```

### Hooks 的实现总结

| 特性 | 实现方式 | 目的 |
|------|---------|------|
| **状态持久化** | 通过 `alternate.hooks` 保存上一次的状态 | 让函数组件有"记忆" |
| **顺序依赖** | 使用数组索引 `hookIndex` | 简化实现，匹配新旧 hook |
| **异步更新** | `setState` 只加入队列，不立即执行 | 批量更新，提升性能 |
| **函数式更新** | `action(oldState)` | 确保基于最新状态更新 |
| **独立性** | 每个 fiber 有自己的 `hooks` 数组 | 组件实例状态隔离 |

### 为什么 React 的 Hooks 这么设计？

1. **简洁性**：数组索引比 key-value 映射更简单
2. **性能**：数组访问比 Map 查找更快
3. **可预测性**：强制顺序调用避免了很多 bug
4. **与 Fiber 天然契合**：hooks 存储在 fiber 节点上

---

## 总结

Didact 通过 Fiber 架构实现了：
- ✅ 可中断的渲染过程
- ✅ 优先级调度
- ✅ 增量式更新
- ✅ 高效的 DOM diff 和更新
- ✅ 简洁而强大的 Hooks 系统

**Hooks 的核心思想：**
- 用**数组索引**管理状态
- 用**队列**实现异步更新
- 用**函数式更新**保证正确性
- 用**alternate fiber** 保存历史状态

这个 300 多行的代码展示了现代前端框架最核心的设计理念！
