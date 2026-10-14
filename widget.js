// widget.js

const RealtorWidget = (() => {
  let config = {
    containerId: 'realtor-widget-container',
    // webhookUrl is not defined here. It must be provided at runtime via
    // `window.ListingPilotConfig.webhookUrl` so deployments don't need to edit
    // this file to point to their own API endpoint.
    branding: {
      logo: 'https://i.ibb.co/fV7Z2NVT/Logo-removebg-modified.png',
      themeColor: '#2c3e50'
    }
  };

  // In-memory fallback if localStorage isn't available (e.g. private browsing)
  let memoryConversationId = null;

  // Generate a UUID v4-style
  function generateUUID() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Retrieve or create a persistent conversation ID. Persisting the ID allows
  // the webhook backend to maintain state across messages, enabling multi-turn
  // conversational flows.
  function getConversationId() {
    const key = 'ListingPilotConversationId';
    const testingMode = window?.ListingPilotConfig?.testingMode;

    // In testing mode we skip persistence entirely so each page load starts
    // with a fresh ID. We also clear any saved ID in localStorage to avoid
    // confusion when switching between modes.
    if (testingMode) {
      try {
        window.localStorage?.removeItem(key);
      } catch (err) {
        // ignore storage errors in testing mode
      }

      if (!memoryConversationId) memoryConversationId = generateUUID();
      return memoryConversationId;
    }

    try {
      if (window.localStorage) {
        let id = localStorage.getItem(key);
        if (!id) {
          id = generateUUID();
          localStorage.setItem(key, id);
        }
        return id;
      }
    } catch (err) {
      console.warn('localStorage unavailable, using in-memory ID');
    }

    // If localStorage is not accessible (e.g. private mode), use memory only
    // for this page session
    if (!memoryConversationId) memoryConversationId = generateUUID();
    return memoryConversationId;
  }

  // Utility: Create element with attributes and optional text.
  function createElement(tag, attrs = {}, textContent = '') {
    const el = document.createElement(tag);
    for (const key in attrs) {
      el.setAttribute(key, attrs[key]);
    }
    if (textContent) el.textContent = textContent;
    
    // Add animation delay based on existing messages
    const existingMessages = document.querySelectorAll('.widget-message').length;
    el.style.animationDelay = `${existingMessages * 0.1}s`;
    
    return el;
  }

  // Retrieve the webhook URL from the global ListingPilotConfig object. This
  // allows deployments to provide their own endpoint without modifying the
  // widget source. If the value is missing or looks like a placeholder, a
  // configuration error is displayed and `null` is returned.
  function getWebhookUrl() {
    const url = window?.ListingPilotConfig?.webhookUrl;
    if (typeof url === 'string' && !/REPLACE_ME|YOUR_WEBHOOK_URL/i.test(url)) {
      try {
        const parsed = new URL(url, window.location.href);
        if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
            parsed.hostname !== 'example.com' && !parsed.username && !parsed.password) {
          return parsed.href;
        }
      } catch (err) {
        // Invalid or incomplete URL; show the same configuration error below.
      }
    }
    console.error('ListingPilot webhook URL not configured.');
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer && !document.querySelector('.widget-config-error')) {
      const errEl = createElement(
        'div',
        { class: 'widget-message assistant error widget-config-error' },
        'Chat widget not configured. Please set window.ListingPilotConfig.webhookUrl.'
      );
      chatContainer.appendChild(errEl);
    }
    return null;
  }

  // Scroll chat container to bottom.
  function scrollChatToBottom(chatContainer) {
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }


  // Placeholder for showing available booking slots.
  function showBookingOptions(slots) {
    console.log('Show booking options', slots);
    // TODO: implement UI for slots
  }

  // Placeholder for showing booking confirmation details.
  function showBookingConfirmation(info) {
    console.log('Show booking confirmation', info);
    // TODO: implement UI for booking confirmation
  }


  async function sendMessageToAPI(message) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return { error: 'Webhook URL not configured' };
  }
  try {
    const payload = {
      conversationId: getConversationId(),
      message,
      pageUrl: window.location.href
    };
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    if (!response.ok) {
      return { error: `HTTP error ${response.status}` };
    }
    if (!text) {
      return { error: "Empty response from server" };
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      // A plain-text webhook reply is also a valid assistant message.
      return { response: text };
    }
  } catch (err) {
    console.error('[Widget] Request failed:', err);
    return { error: 'Could not reach the chat service. Please try again.' };
  }
}

  function displayText(value) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  }

  function safeHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim() === '#') return null;
    try {
      const parsed = new URL(value, window.location.href);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
    } catch (err) {
      return null;
    }
  }

  // Render text and links as DOM nodes so webhook data cannot inject markup.
  function displayListings(listings, chatContainer) {
    const container = createElement("div", { class: "listings-container" });
    listings.forEach(listing => {
      if (!listing || typeof listing !== 'object') return;
      const card = createElement("div", { class: "listing-card" });
      const title = displayText(listing.title ?? listing.Title ?? listing.Address) || 'Property listing';
      const imageUrl = safeHttpUrl(listing.imageUrl ?? listing.ImageURL ?? listing.Image);
      const detailsUrl = safeHttpUrl(listing.detailsUrl ?? listing.URL ?? listing.url);
      if (imageUrl) {
        card.appendChild(createElement('img', {
          src: imageUrl, alt: title, class: 'listing-image', loading: 'lazy'
        }));
      }
      const info = createElement('div', { class: 'listing-info' });
      info.appendChild(createElement('div', { class: 'listing-title' }, title));
      const price = displayText(listing.price ?? listing.Price);
      if (price) info.appendChild(createElement('div', { class: 'listing-price' }, price));
      const details = [
        [listing.beds ?? listing.Beds, 'beds'],
        [listing.baths ?? listing.Baths, 'baths'],
        [listing.sqft ?? listing.Sqft, 'sq ft']
      ].filter(([value]) => displayText(value)).map(([value, label]) => `${displayText(value)} ${label}`);
      if (details.length) info.appendChild(createElement('div', { class: 'listing-detail' }, details.join(' · ')));
      if (detailsUrl) {
        info.appendChild(createElement('a', {
          href: detailsUrl, target: '_blank', rel: 'noopener noreferrer', class: 'listing-link'
        }, 'View details'));
      }
      card.appendChild(info);
      container.appendChild(card);
    });
    if (container.children.length) chatContainer.appendChild(container);
  }

  function messageText(value) {
    if (value && typeof value === 'object') {
      return displayText(value.text ?? value.content ?? value.message);
    }
    return displayText(value);
  }

  // Accept both the README's nested response and earlier action/data replies.
  async function processApiResponse(apiResponse, chatContainer) {
    if (!chatContainer) return;
    const root = apiResponse && typeof apiResponse === 'object' ? apiResponse : { response: apiResponse };
    if (root.error) {
      chatContainer.appendChild(createElement('div', { class: 'widget-message assistant error' },
        messageText(root.error) || 'The chat service returned an error.'));
      scrollChatToBottom(chatContainer);
      return;
    }
    const nested = root.response && typeof root.response === 'object' ? root.response : {};
    const messageArray = Array.isArray(nested.messages) ? nested.messages :
      Array.isArray(root.messages) ? root.messages : null;
    const messages = messageArray ? messageArray.map(messageText).filter(Boolean) :
      [messageText(root.replyText ?? root.response ?? root.message ?? root.text ?? nested.text ?? nested.message)].filter(Boolean);
    messages.forEach(message => chatContainer.appendChild(
      createElement('div', { class: 'widget-message assistant' }, message)));

    const listings = nested.listings ?? root.listings ?? root.data?.listings;
    if (Array.isArray(listings)) displayListings(listings, chatContainer);

    if (root.action === 'showSlots' && Array.isArray(root.data?.slots)) {
      showBookingOptions(root.data.slots);
    } else if (root.action === 'bookingConfirmed' && root.data?.bookingInfo) {
      showBookingConfirmation(root.data.bookingInfo);
    }
    if (!messages.length && (!Array.isArray(listings) || !listings.length)) {
      chatContainer.appendChild(createElement('div', { class: 'widget-message assistant error' },
        'The chat service returned no displayable content.'));
    }
    scrollChatToBottom(chatContainer);
  }


  // The standalone example includes its own markup; the documented embed only
  // supplies an empty container, so build the same controls in that case.
  function ensureMarkup(container) {
    let chatContainer = container.querySelector('#chat-container');
    let form = container.querySelector('#chat-form');
    let input = container.querySelector('#chat-input');
    if (chatContainer && form && input) return { chatContainer, form, input };
    if (container.children.length) {
      console.error('ListingPilot widget markup is incomplete.');
      return null;
    }

    const toggle = createElement('input', { id: 'widget-toggle', type: 'checkbox' });
    const header = createElement('label', { for: 'widget-toggle', class: 'widget-header' });
    const logoUrl = safeHttpUrl(config.branding?.logo ?? window.ListingPilotConfig?.logoUrl);
    if (logoUrl) header.appendChild(createElement('img', { class: 'widget-logo', src: logoUrl, alt: '' }));
    header.appendChild(createElement('span', { class: 'widget-title' },
      displayText(config.branding?.agentName ?? window.ListingPilotConfig?.agentName) || 'Realtor Assistant'));
    const body = createElement('div', { class: 'widget-body' });
    const content = createElement('div', { class: 'widget-content' });
    chatContainer = createElement('div', { id: 'chat-container', class: 'widget-chat-container' });
    content.appendChild(chatContainer);
    content.appendChild(createElement('p', { class: 'widget-instructions' },
      'Ask about property listings or finding your next home.'));
    const footer = createElement('div', { class: 'widget-footer' });
    form = createElement('form', { id: 'chat-form' });
    input = createElement('input', {
      id: 'chat-input', type: 'text', placeholder: 'Type your message...', autocomplete: 'off',
      'aria-label': 'Message'
    });
    form.appendChild(input);
    form.appendChild(createElement('button', { type: 'submit' }, 'Send'));
    footer.appendChild(form);
    body.appendChild(content);
    body.appendChild(footer);
    container.appendChild(toggle);
    container.appendChild(header);
    container.appendChild(body);
    return { chatContainer, form, input };
  }

  // Initialize chat functionality.
  async function init(options = {}) {
    config = { ...config, ...options };
    const container = document.getElementById(config.containerId);
    if (!container) {
      console.error(`Container with id ${config.containerId} not found.`);
      return;
    }
    const markup = ensureMarkup(container);
    if (!markup) return;
    const { chatContainer, form, input } = markup;
    
    // Clear initial chat.
    chatContainer.innerHTML = '';
    // Check after clearing so the configuration error stays visible.
    getWebhookUrl();
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userMsg = input.value.trim();
      if (!userMsg) return;
      
      // Remove instructions if present.
      const instructionsEl = document.querySelector('.widget-instructions');
      if (instructionsEl) instructionsEl.remove();
      
      // Append user message.
      const userMsgEl = createElement('div', { class: 'widget-message user' }, userMsg);
      chatContainer.appendChild(userMsgEl);
      scrollChatToBottom(chatContainer);
      input.value = '';
      
      // Show typing indicator.
      const tempMsgEl = createElement('div', { class: 'widget-message assistant typing' });
      tempMsgEl.innerHTML = '<div class="spinner"></div><span>Typing...</span>';
      chatContainer.appendChild(tempMsgEl);
      
      const apiResponse = await sendMessageToAPI(userMsg);
      tempMsgEl.remove();

      await processApiResponse(apiResponse, chatContainer);
      scrollChatToBottom(chatContainer);
      
    });
  }

  return { init, sendMessageToAPI };
})();

window.RealtorWidget = RealtorWidget;
