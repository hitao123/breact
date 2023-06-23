export function render(element, container) {

    const dom = element.type === 'TEXT_ELEMENT'
        ? document.createTextNode('')
        : document.createElement(element.type);

    const isProperty = key => key !== 'children';

    Object.keys(element.props)
        .filter(isProperty)
        .forEach(name => {
            dom[name] =  element.props[name];
        });

    console.log('ele', element)

    element.props.children.forEach(child => {
        render(child, dom);
    });
    
    container.appendChild(dom);
}
