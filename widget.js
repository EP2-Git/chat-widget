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
      
      let responseContent = apiResponse.response;
      let structured;
      
      // Enhanced response parsing
      try {
          // Handle string responses by attempting to parse them
          if (typeof responseContent === 'string') {
              structured = JSON.parse(responseContent);
          } else if (typeof responseContent === 'object') {
              structured = responseContent;
          } else {
              throw new Error('Invalid response format');
          }

          // Ensure the response has the expected structure
          structured = {
              messages: Array.isArray(structured.messages) ? structured.messages : 
                       [structured.message || 'No message provided'],
              listings: Array.isArray(structured.listings) ? structured.listings : []
          };

          // Display sequential messages
          for (const message of structured.messages) {
              const messageEl = createElement('div', { 
                  class: 'widget-message assistant'
              }, message);
              chatContainer.appendChild(messageEl);
              scrollChatToBottom(chatContainer);

              // Add a small delay between messages for better readability
              await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Display listings if available
          if (structured.listings.length > 0) {
              const listingsContainer = createElement('div', { class: 'listings-container' });
              
              structured.listings.forEach(listing => {
                  // Ensure all listing properties exist and are formatted
                  const formattedListing = {
                      Price: listing.Price || 'Price not available',
                      Beds: listing.Beds || 'N/A',
                      Baths: listing.Baths || 'N/A',
                      Sqft: listing.Sqft || 'N/A',
                      Description: listing.Description || '',
                      URL: listing.URL || '#'
                  };

                  const listingCard = createElement('div', { class: 'listing-card' });
                  listingCard.innerHTML = `
                      <div class="listing-title">${formattedListing.Price}</div>
                      <div class="listing-detail">Beds: ${formattedListing.Beds}</div>
                      <div class="listing-detail">Baths: ${formattedListing.Baths}</div>
                      <div class="listing-detail">Size: ${formattedListing.Sqft}</div>
                      ${formattedListing.Description ? 
                          `<div class="listing-description">${formattedListing.Description}</div>` : 
                          ''}
                      <a href="${formattedListing.URL}" class="listing-link" target="_blank">View Property</a>
                  `;
                  listingsContainer.appendChild(listingCard);
              });
              
              chatContainer.appendChild(listingsContainer);
          }

      } catch (error) {
          console.error('Error processing response:', error);
          const errorMsg = createElement('div', { 
              class: 'widget-message assistant error'
          }, "I apologize, but I encountered an error processing the response. Please try again.");
          chatContainer.appendChild(errorMsg);
      }
      
      scrollChatToBottom(chatContainer);
    });
  }

  return { init, sendMessageToAPI };
})();

window.RealtorWidget = RealtorWidget;
