export default async function handler(req, res) {
  const targetUrl = 'https://mrn-stream-stortv.up.railway.app' + req.url;
  
  try {
    // Prepare headers for proxied request
    const proxyHeaders = {
      ...req.headers,
      host: 'mrn-stream-stortv.up.railway.app',
    };
    // Remove headers that might cause issues
    delete proxyHeaders['x-forwarded-host'];
    delete proxyHeaders['x-vercel-id'];
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    
    // Copy headers from proxied response
    response.headers.forEach((value, key) => {
      // Skip headers that shouldn't be copied
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    // If it's HTML, inject Speed Insights
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      const speedInsightsScript = `
<script>
  window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
</script>
<script defer src="/_vercel/speed-insights/script.js"></script>`;
      
      // Try to inject before </head> (case-insensitive)
      if (html.toLowerCase().includes('</head>')) {
        html = html.replace(/<\/head>/i, speedInsightsScript + '\n</head>');
      } else if (html.toLowerCase().includes('<head>')) {
        html = html.replace(/<head>/i, '<head>\n' + speedInsightsScript);
      } else if (html.toLowerCase().includes('<html>')) {
        html = html.replace(/<html>/i, '<html>\n<head>' + speedInsightsScript + '\n</head>');
      } else {
        // If no proper structure, prepend
        html = speedInsightsScript + '\n' + html;
      }
      
      res.status(response.status).send(html);
    } else {
      // For non-HTML content, stream the response
      const buffer = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy failed', message: error.message });
  }
}
