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
