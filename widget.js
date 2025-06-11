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
    if (url && typeof url === 'string' && !/REPLACE_ME|YOUR_WEBHOOK_URL/i.test(url)) {
      return url;
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

  // Display a list of property listings in the chat.
  function displayListings(listings) {
    const chatContainer = document.getElementById('chat-container');
    const listingsContainer = createElement('div', { class: 'listings-container' });

    listings.forEach(listing => {
      const formatted = {
        Price: listing.Price || 'Price not available',
        Beds: listing.Beds || 'N/A',
        Baths: listing.Baths || 'N/A',
        Sqft: listing.Sqft || 'N/A',
        Description: listing.Description || '',
        URL: listing.URL || '#'
      };

      const card = createElement('div', { class: 'listing-card' });
      card.innerHTML = `
        <div class="listing-title">${formatted.Price}</div>
        <div class="listing-detail">Beds: ${formatted.Beds}</div>
        <div class="listing-detail">Baths: ${formatted.Baths}</div>
        <div class="listing-detail">Size: ${formatted.Sqft}</div>
        ${formatted.Description ? `<div class="listing-description">${formatted.Description}</div>` : ''}
        <a href="${formatted.URL}" class="listing-link" target="_blank">View Property</a>
      `;
      listingsContainer.appendChild(card);
    });

    chatContainer.appendChild(listingsContainer);
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

  // Process API responses in a backend-agnostic way.
  // This decouples the widget from any specific response schema so
  // the n8n workflow can drive UI behavior via "action" and "data".
  function processApiResponse(apiResponse, chatContainer) {
    if (!chatContainer) return;

    if (apiResponse.error) {
      const errorEl = createElement('div', { class: 'widget-message assistant error' }, apiResponse.error);
      chatContainer.appendChild(errorEl);
      scrollChatToBottom(chatContainer);
      return;
    }

    const replyText = apiResponse.replyText || apiResponse.response || apiResponse.message || '';
    if (replyText) {
      const messageEl = createElement('div', { class: 'widget-message assistant' }, replyText);
      chatContainer.appendChild(messageEl);
    }

    const action = apiResponse.action;
    const data = apiResponse.data || {};
    if (action === 'showSlots' && Array.isArray(data.slots)) {
      showBookingOptions(data.slots);
    } else if (action === 'bookingConfirmed' && data.bookingInfo) {
      showBookingConfirmation(data.bookingInfo);
    } else if (action === 'showListings' && Array.isArray(data.listings)) {
      displayListings(data.listings);
    }

    scrollChatToBottom(chatContainer);
  }

  // Send user message to API.
  async function sendMessageToAPI(message) {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      return { error: 'Webhook URL not configured' };
    }
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: getConversationId(),
          message,
          pageUrl: window.location.href
        })
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Error sending message:', err);
      return { error: err.message };
    }
  }
  // Render a series of listing cards under the bot message.
  // listings: [{ title, imageUrl, price, detailsUrl }]
  function displayListings(listings, chatContainer) {
    const container = createElement("div", { class: "listings-container" });
    listings.forEach(listing => {
      const card = createElement("div", { class: "listing-card" });
      card.innerHTML = `
        <img src="${listing.imageUrl}" alt="${listing.title}" class="listing-image">
        <div class="listing-info">
          <div class="listing-title">${listing.title}</div>
          <div class="listing-price">${listing.price}</div>
          <a href="${listing.detailsUrl}" target="_blank" class="listing-link">View details</a>
        </div>`;
      container.appendChild(card);
    });
    chatContainer.appendChild(container);
  }


  // Process API response (Prompt 3)
  async function processApiResponse(apiResponse, chatContainer) {
    let content = apiResponse.data || apiResponse.response;
    let structured = {};
    try {
      structured = typeof content === "string" ? JSON.parse(content) : (content || {});
    } catch (e) {
      console.error("Failed to parse API response", e);
      structured = {};
    }
    const messages = Array.isArray(structured.messages) ? structured.messages : [structured.message || structured.text || ""];
    for (const message of messages) {
      const el = createElement("div", { class: "widget-message assistant" }, message);
      chatContainer.appendChild(el);
      scrollChatToBottom(chatContainer);
      await new Promise(r => setTimeout(r, 500));
    }
    if (structured.action === "showListings" && Array.isArray(structured.listings)) {
      // Use helper to show multiple listings returned by the n8n workflow
      displayListings(structured.listings, chatContainer);
    }
  }

  // Initialize chat functionality.
  async function init(options = {}) {
    config = { ...config, ...options };
    const container = document.getElementById(config.containerId);
    if (!container) {
      console.error(`Container with id ${config.containerId} not found.`);
      return;
    }
    // Check webhook configuration on init so misconfiguration is visible even
    // before a message is sent.
    getWebhookUrl();
    // Chat container, form, and input are assumed to be present in the HTML.
    const chatContainer = document.getElementById('chat-container');
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    
    // Clear initial chat.
    chatContainer.innerHTML = '';
    
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
