export function render(element, container) {
  // 需删除 root container 内的所有子节点
  // while (container.firstChild) {
  //     element.removeChild(element.container);
  // }
  const dom = element.type === 'TEXT_ELEMENT' ? document.createTextNode('') : document.createElement(element.type);

  const isProperty = key => key !== 'children';

  Object.keys(element.props).filter(isProperty).forEach(name => {
    dom[name] = element.props[name];
  });
  console.log('ele', element);
  element.props.children.forEach(child => {
    render(child, dom);
  });
  container.appendChild(dom);
}