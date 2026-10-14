const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'widget.js'), 'utf8');

class Element {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.document = document;
    this.attributes = {};
    this.children = [];
    this.style = {};
    this.listeners = {};
    this.value = '';
    this._textContent = '';
    this._innerHTML = '';
    this.parent = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter(child => child !== this);
      this.parent = null;
    }
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map(child => child.textContent).join('');
  }

  set innerHTML(value) {
    this.document.htmlWrites.push({ element: this, value: String(value) });
    this._innerHTML = String(value);
    this.children = [];
    this._textContent = '';
  }

  get innerHTML() {
    return this._innerHTML;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = element => {
      for (const child of element.children) {
        const classes = child.getAttribute('class')?.split(/\s+/) ?? [];
        if (selector.startsWith('.') && selector.slice(1).split('.').every(name => classes.includes(name))) {
          matches.push(child);
        } else if (selector.startsWith('#') && child.getAttribute('id') === selector.slice(1)) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

function makeWidget({ webhookUrl = 'https://example.test/chat', payload, status = 200, emptyContainer = false, rawText, logoUrl } = {}) {
  const document = {
    htmlWrites: [],
    createElement(tag) { return new Element(tag, this); },
    getElementById(id) { return this.root.querySelector(`#${id}`); },
    querySelector(selector) { return this.root.querySelector(selector); },
    querySelectorAll(selector) { return this.root.querySelectorAll(selector); }
  };
  document.root = document.createElement('body');
  const container = document.createElement('div');
  container.setAttribute('id', 'realtor-widget-container');
  const chat = document.createElement('div');
  chat.setAttribute('id', 'chat-container');
  const instructions = document.createElement('p');
  instructions.setAttribute('class', 'widget-instructions');
  const form = document.createElement('form');
  form.setAttribute('id', 'chat-form');
  const input = document.createElement('input');
  input.setAttribute('id', 'chat-input');
  if (!emptyContainer) {
    container.appendChild(chat);
    container.appendChild(instructions);
    container.appendChild(form);
    container.appendChild(input);
  }
  document.root.appendChild(container);

  const calls = [];
  const window = {
    ListingPilotConfig: { webhookUrl, testingMode: true, logoUrl },
    location: { href: 'https://example.test/page' },
    crypto: { randomUUID: () => 'test-session-id' }
  };
  const context = {
    window,
    document,
    URL,
    crypto: window.crypto,
    console: { log() {}, warn() {}, error() {} },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: status >= 200 && status < 300, status,
        text: async () => rawText === undefined ? JSON.stringify(payload) : rawText };
    }
  };
  vm.runInNewContext(source, context, { filename: 'widget.js' });
  return { widget: window.RealtorWidget, document, chat, form, input, calls };
}

async function submit(testWidget, message) {
  testWidget.input.value = message;
  await testWidget.form.listeners.submit({ preventDefault() {} });
}

test('documented structured response renders messages and capitalized listing fields', async () => {
  const fixture = makeWidget({ payload: {
    response: {
      messages: ['Here are two options', 'The first has three bedrooms'],
      listings: [{ Price: '$300k', Beds: 3, Baths: 2, Sqft: 1500, URL: 'https://example.test/home/1' }]
    }
  } });
  await fixture.widget.init();
  await submit(fixture, 'Show me homes');

  const messages = fixture.chat.querySelectorAll('.widget-message.assistant');
  assert.equal(messages.length, 2);
  assert.equal(messages[0].textContent, 'Here are two options');
  assert.equal(messages[1].textContent, 'The first has three bedrooms');
  assert.equal(fixture.chat.querySelectorAll('.listing-card').length, 1);
  assert.match(fixture.chat.textContent, /\$300k/);
  assert.match(fixture.chat.textContent, /3 beds/);
  assert.equal(fixture.chat.querySelector('.listing-link').getAttribute('href'), 'https://example.test/home/1');
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].url, 'https://example.test/chat');
  assert.equal(JSON.parse(fixture.calls[0].options.body).message, 'Show me homes');
});

test('listing fields stay text and unsafe URLs never become links or images', async () => {
  const injected = '<img src=x onerror=alert(1)>';
  const fixture = makeWidget({ payload: {
    response: {
      messages: ['Found one'],
      listings: [{ title: injected, price: injected, imageUrl: 'javascript:alert(1)', detailsUrl: 'javascript:alert(1)' }]
    }
  } });
  await fixture.widget.init();
  await submit(fixture, 'Show one');

  assert.equal(fixture.chat.querySelector('.listing-title').textContent, injected);
  assert.equal(fixture.chat.querySelector('.listing-price').textContent, injected);
  assert.equal(fixture.chat.querySelector('.listing-link'), null);
  assert.equal(fixture.chat.querySelector('.listing-image'), null);
  assert.ok(fixture.document.htmlWrites.every(write => !write.value.includes(injected)));
});

test('missing webhook configuration remains visible after initialization and sends nothing', async () => {
  const fixture = makeWidget({ webhookUrl: null, payload: { response: 'never called' } });
  await fixture.widget.init();
  assert.match(fixture.chat.textContent, /not configured/i);
  await submit(fixture, 'Hello');
  assert.equal(fixture.calls.length, 0);
});

test('simple response and legacy showListings response remain supported', async () => {
  const simple = makeWidget({ payload: { response: 'Hello!' } });
  await simple.widget.init();
  await submit(simple, 'Hi');
  assert.match(simple.chat.textContent, /Hello!/);

  const legacy = makeWidget({ payload: {
    replyText: 'One match', action: 'showListings',
    data: { listings: [{ title: 'Home A', price: '$240k', detailsUrl: '/home/a' }] }
  } });
  await legacy.widget.init();
  await submit(legacy, 'Find a home');
  assert.equal(legacy.chat.querySelectorAll('.listing-card').length, 1);
  assert.equal(legacy.chat.querySelector('.listing-link').getAttribute('href'), 'https://example.test/home/a');
});

test('an empty embed container builds usable controls and handles plain-text replies', async () => {
  const fixture = makeWidget({ emptyContainer: true, rawText: 'Plain text reply', logoUrl: 'https://example.test/customer-logo.png' });
  await fixture.widget.init();
  const input = fixture.document.getElementById('chat-input');
  const form = fixture.document.getElementById('chat-form');
  const chat = fixture.document.getElementById('chat-container');
  assert.ok(fixture.document.querySelector('.widget-header'));
  assert.equal(fixture.document.querySelector('.widget-logo').getAttribute('src'), 'https://example.test/customer-logo.png');
  input.value = 'Hello';
  await form.listeners.submit({ preventDefault() {} });
  assert.match(chat.textContent, /Plain text reply/);
});

test('example URL stays a visible configuration error without a request', async () => {
  const fixture = makeWidget({ webhookUrl: 'https://example.com/webhook' });
  await fixture.widget.init();
  assert.match(fixture.chat.textContent, /not configured/i);
  await submit(fixture, 'Hello');
  assert.equal(fixture.calls.length, 0);
});

test('HTTP failures are shown without treating error HTML as a reply', async () => {
  const fixture = makeWidget({ status: 503, rawText: '<html>Unavailable</html>' });
  await fixture.widget.init();
  await submit(fixture, 'Hello');
  assert.match(fixture.chat.textContent, /HTTP error 503/);
  assert.doesNotMatch(fixture.chat.textContent, /<html>/);
});
