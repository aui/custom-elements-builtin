import attributesObserver from '@webreflection/custom-elements-attributes';
import qsaObserver from 'qsa-observer';

const {
  customElements, document,
  Element, MutationObserver, Object, Promise,
  Map, Set, WeakMap
} = self;

const {attachShadow} = Element.prototype;
const {createElement} = document;
const {_, define, get} = customElements;
const {defineProperty, getOwnPropertyNames, setPrototypeOf} = Object;

const shadowRoots = new WeakMap;
const shadows = new Set;

const classes = new Map;
const defined = new Map;
const prototypes = new Map;
const registry = new Map;

const shadowed = [];
const query = [];

const getCE = is => registry.get(is) || get.call(customElements, is);

const handle = (element, connected, selector) => {
  const proto = prototypes.get(selector);
  if (connected && !proto.isPrototypeOf(element)) {
    override = setPrototypeOf(element, proto);
    try { new proto.constructor; }
    finally { override = null; }
  }
  const method = `${connected ? '' : 'dis'}connectedCallback`;
  if (method in proto)
    element[method]();
};

const {parse} = qsaObserver({query, handle});

const {parse: parseShadowed} = qsaObserver({
  query: shadowed,
  handle(element, connected) {
    if (shadowRoots.has(element)) {
      if (connected)
        shadows.add(element);
      else
        shadows.delete(element);
      parseShadow.call(query, element);
    }
  }
});

const whenDefined = name => {
  if (!defined.has(name)) {
    let _, $ = new Promise($ => { _ = $; });
    defined.set(name, {$, _});
  }
  return defined.get(name).$;
};

const augment = attributesObserver(whenDefined, MutationObserver);

let override = null;

getOwnPropertyNames(self)
  .filter(k => /^HTML(?!Element)/.test(k))
  .forEach(k => {
    function HTMLBuiltIn() {
      const {constructor} = this;
      if (!classes.has(constructor)) {
        if (_ && _.classes.has(constructor))
          return;
        throw new TypeError('Illegal constructor');
      }
      const {is, tag} = classes.get(constructor);
      if (override)
        return augment(override, is);
      const element = createElement.call(document, tag);
      element.setAttribute('is', is);
      return augment(setPrototypeOf(element, constructor.prototype), is);
    }
    setPrototypeOf(HTMLBuiltIn, self[k]);
    (HTMLBuiltIn.prototype = self[k].prototype).constructor = HTMLBuiltIn;
    defineProperty(self, k, {value: HTMLBuiltIn});
  });

defineProperty(document, 'createElement', {
  value(name, options) {
    const is = options && options.is;
    if (is) {
      const Class = registry.get(is);
      if (Class && classes.get(Class).tag === name)
        return new Class;
    }
    const element = createElement.call(document, name);
    if (is)
      element.setAttribute('is', is);
    return element;
  }
});

defineProperty(Element.prototype, 'attachShadow', {
  value() {
    const root = attachShadow.apply(this, arguments);
    const {parse} = qsaObserver({query, root, handle});
    shadowRoots.set(this, {root, parse});
    return root;
  }
});

defineProperty(customElements, 'get', {
  configurable: true,
  value: getCE
});

defineProperty(customElements, 'whenDefined', {
  configurable: true,
  value: whenDefined
});

defineProperty(customElements, 'define', {
  configurable: true,
  value(is, Class, options) {
    let selector;
    const tag = options && options.extends;
    if (tag) {
      if (getCE(is))
        throw new Error(`'${is}' has already been defined as a custom element`);
      selector = `${tag}[is="${is}"]`;
      classes.set(Class, {is, tag});
      prototypes.set(selector, Class.prototype);
      registry.set(is, Class);
      query.push(selector);
    }
    else {
      define.apply(customElements, arguments);
      shadowed.push(selector = is);
    }
    whenDefined(is).then(() => {
      if (tag) {
        parse(document.querySelectorAll(selector));
        shadows.forEach(parseShadow, [selector]);
      }
      else
        parseShadowed(document.querySelectorAll(selector));
    });
    defined.get(is)._(Class);
  }
});

function parseShadow(element) {
  const {parse, root} = shadowRoots.get(element);
  parse(root.querySelectorAll(this), element.isConnected);
}
