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
  console.log("[Widget] sendMessageToAPI called with message:", message);
  console.log("[Widget] Retrieved webhookUrl:", webhookUrl);
  if (!webhookUrl) {
    console.warn("[Widget] No webhook URL configured, returning error.");
    return { error: 'Webhook URL not configured' };
  }
  try {
    const payload = {
      conversationId: getConversationId(),
      message,
      pageUrl: window.location.href
    };
    console.log("[Widget] Sending payload:", payload);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("[Widget] Fetch completed, status:", response.status, response.statusText);
    // Read raw text first to log it
    const text = await response.text();
    console.log("[Widget] Raw response text:", text);
    if (!response.ok) {
      // If status not OK, log and return error
      console.warn(`[Widget] Non-OK HTTP status: ${response.status}`);
      // Optionally try parse JSON even on non-OK, but here:
      return { error: `HTTP error ${response.status}` };
    }
    if (!text) {
      console.warn("[Widget] Empty response body");
      return { error: "Empty response from server" };
    }
    let data;
    try {
      data = JSON.parse(text);
      console.log("[Widget] Parsed JSON response:", data);
    } catch (parseErr) {
      console.error("[Widget] JSON parse error:", parseErr, "Response text:", text);
      return { error: "Invalid JSON response" };
    }
    return data;
  } catch (err) {
    console.error("[Widget] Error sending message (fetch threw):", err);
    return { error: err.message || "Network error" };
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
  console.log("[Widget] processApiResponse called with:", apiResponse, "chatContainer:", chatContainer);
  if (!chatContainer) {
    console.warn("[Widget] processApiResponse: chatContainer is null/undefined");
    return;
  }

  // Handle error field first
  if (apiResponse.error) {
    console.log("[Widget] processApiResponse: error field detected:", apiResponse.error);
    const errorEl = createElement('div', { class: 'widget-message assistant error' }, apiResponse.error);
    chatContainer.appendChild(errorEl);
    scrollChatToBottom(chatContainer);
    return;
  }

  // Determine replyText, falling back to older fields if needed
  const replyText = apiResponse.replyText 
                    || apiResponse.response 
                    || apiResponse.message 
                    || apiResponse.text 
                    || "";
  console.log("[Widget] processApiResponse: determined replyText:", replyText);

  if (replyText) {
    const messageEl = createElement('div', { class: 'widget-message assistant' }, replyText);
    console.log("[Widget] processApiResponse: appending assistant message:", replyText);
    chatContainer.appendChild(messageEl);
    scrollChatToBottom(chatContainer);
    // optional delay removed for simplicity; if you want delay:
    // await new Promise(r => setTimeout(r, 500));
  } else {
    console.log("[Widget] processApiResponse: no replyText found, skipping message append");
  }

  // Handle action and data
  const action = apiResponse.action;
  const data = apiResponse.data || {};
  console.log("[Widget] processApiResponse: action:", action, "data:", data);

  if (action === 'showSlots' && Array.isArray(data.slots)) {
    console.log("[Widget] processApiResponse: calling showBookingOptions with slots:", data.slots);
    showBookingOptions(data.slots);
  } else if (action === 'bookingConfirmed' && data.bookingInfo) {
    console.log("[Widget] processApiResponse: calling showBookingConfirmation with info:", data.bookingInfo);
    showBookingConfirmation(data.bookingInfo);
  } else if (action === 'showListings' && Array.isArray(data.listings)) {
    console.log("[Widget] processApiResponse: calling displayListings with listings:", data.listings);
    displayListings(data.listings, chatContainer);
  } else {
    if (action) {
      console.log("[Widget] processApiResponse: unrecognized or no-op action:", action);
    }
  }

  scrollChatToBottom(chatContainer);
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
