// widget.js

const RealtorWidget = (() => {
  let config = {
    containerId: 'realtor-widget-container',
    chatEndpoint: 'http://3.143.23.149:5001/chat',
    historyEndpoint: 'http://3.143.23.149:5001/chat/history',
    branding: {
      logo: 'https://i.ibb.co/fV7Z2NVT/Logo-removebg-modified.png',
      themeColor: '#2c3e50'
    }
  };

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
    try {
      const response = await fetch(config.chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('Error sending message:', err);
      return { error: err.message };
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

      // Generic response handler driven by the n8n workflow.
      // The backend now returns a common JSON shape so we delegate
      // UI behavior based on optional "action" and "data" fields.
      processApiResponse(apiResponse, chatContainer);
    });
  }

  return { init, sendMessageToAPI };
})();

window.RealtorWidget = RealtorWidget;
