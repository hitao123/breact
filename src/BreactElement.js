const TEXT_ELEMENT = 'TEXT_ELEMENT';

export function createElement(type, props, ...children) {
    // console.log(...children)
    return {
        type,
        props: {
            ...props,
            children: children.map(child => 
                typeof child === 'object'
                    ? child
                    : createTextElement(child)
            )
        }
    }
}

export function createTextElement(text) {
    return {
        type: TEXT_ELEMENT,
        props: {
            nodeValue: text,
            children: []
        }
    }
}

/**
 * 
 * @param {*} fiber { type: '', props: {} }
 */
export function createDom(fiber) {
    const dom = fiber.type === TEXT_ELEMENT ? document.createTextNode('') : document.createElement(fiber.type);
    const isProperty = (key) => key != 'children'
    
    Object.keys(fiber.props)
    .filter(isProperty)
    .forEach(name => {
        dom[name] = fiber.props[name];
    })

    return dom;
}