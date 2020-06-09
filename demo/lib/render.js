export function render(element, container) {
  // 需删除 root container 内的所有子节点
  // while (container.firstChild) {
  //     element.removeChild(element.container);
  // }
  const dom = element.type === 'TEXT_ELEMENT' ? document.createTextNode('') : document.createElement(element.type);

  const isProperty = key => key !== 'children';

  Object.keys(element.props).filter(isProperty).forEach(prop => {
    dom[name] = element.props[name];
  });
  element.props.children(child => {
    render(child, dom);
  });
  container.appendChild(dom);
}