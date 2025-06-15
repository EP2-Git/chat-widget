# Chat Widget

Embeddable JavaScript widget for realtor demos that sends chat messages to your own webhook service.

## Motivation

This project provides a simple drop‑in widget that can display chat messages and listing cards while delegating all conversation logic to your own webhook.

## Features

- **Configurable webhook endpoint** to route messages wherever you like
- **Session support** via optional history endpoint
- **Generic response parsing** for normal text or structured objects
- **Loading and error UI** so users know what is happening
- **Listing cards** when the webhook replies with property data
- **Easy embedding** with minimal HTML and one JavaScript file

## Prerequisites

You need an HTTP endpoint that implements your chat logic (for example using [n8n](https://n8n.io/) or another service). Ensure that CORS headers allow requests from the domain that will host the widget.

## Installation / Setup

1. Clone or download this repository.
2. Copy `config.example.js` to `config.js` and edit `window.ListingPilotConfig.webhookUrl` to point at your webhook.
3. Add `config.js` and `widget.js` to any web page and include the accompanying `widget.css`.

## Embedding Example

```html
<head>
  <link rel="stylesheet" href="widget.css">
  <script src="config.js"></script>
  <script src="widget.js"></script>
</head>
<body>
  <div id="realtor-widget-container"></div>
  <script>
    RealtorWidget.init();
  </script>
</body>
```

## Configuration Options

`window.ListingPilotConfig` may contain:

- `webhookUrl` – URL that receives POST `{message: "..."}` and returns JSON
- `historyEndpoint` – optional endpoint for past conversation (if supported)
- `agentName` – displayed in the header
- `primaryColor` and `accentColor` – override theme colors
- `testingMode` – if `true`, a new conversation ID is created on each page reload

## CORS Requirements

Your webhook must respond with headers such as:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Methods: POST, OPTIONS
```

## Testing

- **Dummy webhook test**: return `{ "response": "Hello!" }` to confirm basic chat.
- **Listing rendering test**: reply `{ "response": { "messages": ["Here are some listings"], "listings": [{"Price": "$300k", "Beds": 3, "Baths": 2, "Sqft": 1500, "URL": "#"}] } }` and verify cards render.
- **Error handling test**: shut down your webhook or return an error to see the widget display the failure message.

## Customization

You can override colors in `ListingPilotConfig` or write additional CSS after `widget.css` to change fonts, borders, or layout.

## Deployment

Serve the static files (`widget.js`, `widget.css`, `config.js`) from any web host, GitHub Pages or a CDN.

## Contributing

Fork this repository, set your own endpoints in `config.js`, and submit pull requests for improvements. Please avoid committing secrets or real API keys.

## License

This project is released under the [MIT License](LICENSE).

## File Structure

- `widget.js` – main widget logic
- `widget.css` – styles for the widget
- `widget.html` – example page
- `config.example.js` – template configuration file
- `Logo.webp` and other images – demo branding

## Contact

Open an issue on this repository if you have questions or feature requests.

