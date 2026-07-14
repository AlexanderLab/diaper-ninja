import fs from 'node:fs';
import puppeteer from 'puppeteer';
import 'dotenv/config';

// Regular expressions to extract diaper/unit count from Amazon product titles
export function extractCountFromTitle(title) {
  const regexes = [
    // Matches: "224 pañales", "120 units", "96 uds", "80 u."
    /(\d+)\s*(?:pañales|panales|unidades|uds|pcs|diapers|u\b|unid)/i,
    // Matches: "Pack de 100", "x120"
    /(?:pack\s+de|x)\s*(\d+)/i,
    // Matches: "120x pañales", "96x"
    /(\d+)\s*x/i
  ];
  
  for (const regex of regexes) {
    const match = title.match(regex);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > 0) return val;
    }
  }
  return 1; // Default fallback if no count is found
}

// Simple robust CSV parser for Google Sheets export
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  const result = [];
  if (lines.length <= 1) return result;
  
  // Clean headers to lower case
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const nameIndex = headers.indexOf('nombre');
  const urlIndex = headers.indexOf('url');
  const alertIndex = headers.indexOf('precio alerta');
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by comma, respecting quotes
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const fields = matches.map(f => f.replace(/^"|"$/g, '').trim());
    
    if (fields.length >= 2) {
      const name = nameIndex !== -1 ? fields[nameIndex] : fields[0];
      const url = urlIndex !== -1 ? fields[urlIndex] : fields[1];
      const thresholdVal = alertIndex !== -1 ? fields[alertIndex] : (fields[2] || '');
      
      const threshold = parseFloat(thresholdVal) || null;
      
      if (url && url.startsWith('http')) {
        result.push({ name, url, threshold });
      }
    }
  }
  return result;
}

// Check if we are running as a direct script
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  (async () => {
    const timestamp = Date.now();
    const date = new Date(timestamp);
    
    // Use DD/MM/YYYY, HH:MM:SS format
    const fecha = String(date.getDate()).padStart(2, '0') + '/' +
      String(date.getMonth() + 1).padStart(2, '0') + '/' +
      date.getFullYear() + ', ' +
      String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0') + ':' +
      String(date.getSeconds()).padStart(2, '0');

    // --- CONFIGURATION ---
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    const PRODUCTS_SHEET_URL = process.env.PRODUCTS_SHEET_URL;
    const DEFAULT_PRICE_THRESHOLD = 170; // For Nido capazo bebe fallback

    let products = [];

    // Load products list
    if (PRODUCTS_SHEET_URL) {
      console.log('Loading products from Google Sheets URL...');
      try {
        const response = await fetch(PRODUCTS_SHEET_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        products = parseCSV(csvText);
        console.log(`Loaded ${products.length} products successfully from Google Sheets.`);
      } catch (error) {
        console.error('Error fetching Google Sheets, falling back to products.json:', error.message);
      }
    }

    // Fallback to local products.json if empty or failed
    if (products.length === 0) {
      console.log('Loading products from local products.json fallback...');
      try {
        const fileContent = fs.readFileSync('products.json', 'utf8');
        products = JSON.parse(fileContent);
        console.log(`Loaded ${products.length} products successfully from products.json.`);
      } catch (error) {
        console.error('ERROR: Could not read local products.json fallback.', error.message);
        process.exit(1);
      }
    }

    // Save latest products list to frontend public folder so the app can render them without CORS issues
    try {
      const publicDir = 'frontend/public';
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync('frontend/public/products.json', JSON.stringify(products, null, 2));
      console.log('Saved latest products list to frontend/public/products.json');
    } catch (err) {
      console.error('Error writing products.json to frontend public:', err.message);
    }

    const sendTelegramMessage = async (message) => {
      if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('Telegram credentials not configured, skipping alert.');
        return;
      }
      try {
        const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
          })
        });
        console.log('Telegram message sent!');
      } catch (error) {
        console.error('Error sending Telegram message:', error);
      }
    };

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Hide webdriver status to bypass simple anti-bot checks
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1'
    });

    let logEntry = `${fecha}`;

    const csvFile = 'frontend/public/diapers.csv';
    if (!fs.existsSync(csvFile)) {
      const dir = 'frontend/public';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(csvFile, 'Fecha,Producto,Numero de Pañales,Precio,Precio por unidad\r\n');
    }

    for (const product of products) {
      console.log(`Processing product: ${product.name} (${product.url})`);
      try {
        // Go to Amazon product page
        await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait a tiny bit for elements to render
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

        // Check if we hit the CAPTCHA check
        const pageTitle = await page.title();
        if (pageTitle.toLowerCase().includes('bot') || 
            pageTitle.toLowerCase().includes('captcha') || 
            pageTitle.toLowerCase().includes('robot') || 
            pageTitle.toLowerCase().includes('security') ||
            pageTitle === 'Amazon.es' || 
            pageTitle === 'Amazon.es: bot') {
          throw new Error(`Amazon Bot Blocked: Robot Check CAPTCHA page detected (Page Title: "${pageTitle}")`);
        }

        // Extract Title with fallback selectors
        let title = '';
        const titleSelectors = ['#productTitle', '#title', 'h1.a-size-large', 'h1'];
        for (const sel of titleSelectors) {
          try {
            title = await page.$eval(sel, el => el.textContent.trim());
            if (title) break;
          } catch (_) {}
        }
        
        if (!title) {
          throw new Error('failed to find element matching selector "#productTitle" or fallback title selectors');
        }

        const count = extractCountFromTitle(title);
        console.log(`- Extracted title: "${title.slice(0, 50)}..."`);
        console.log(`- Detected count: ${count} units`);

        // Extract Price (Robust parsing with fallback selectors)
        let price = 0;
        const priceSelectors = [
          'span.a-price .a-offscreen',
          '#price_inside_buybox',
          '#newBuyBoxPrice',
          '.a-price-whole'
        ];
        
        for (const sel of priceSelectors) {
          try {
            const rawPrice = await page.$eval(sel, el => el.textContent.trim());
            if (rawPrice) {
              const cleaned = rawPrice.replace(/[^\d.,]/g, '').replace(',', '.');
              price = parseFloat(cleaned);
              if (!isNaN(price) && price > 0) break;
            }
          } catch (_) {}
        }

        if (isNaN(price) || price <= 0) {
          throw new Error('failed to find price element or price parsed is invalid');
        }
        
        console.log(`- Scraped price: ${price}€`);

        const pricePerUnit = (price / count).toFixed(3);
        logEntry += ` | ${product.name} (${count} pañales): ${price}€ (unidad: ${pricePerUnit}€)`;

        // Append to CSV with Windows line ending (using user-defined product name)
        const csvLine = `"${fecha}","${product.name}",${count},${price},${pricePerUnit}\r\n`;
        fs.appendFileSync(csvFile, csvLine);

        // Telegram alert logic
        const alertThreshold = product.threshold || (product.name === 'Nido capazo bebe' ? DEFAULT_PRICE_THRESHOLD : null);
        if (alertThreshold && price <= alertThreshold) {
          const message = `🚨 <b>Diaper Stonks Alert!</b>\n\nEl producto <b>${product.name}</b> ha bajado a <b>${price}€</b> (Límite: ${alertThreshold}€).\n\nEnlace: <a href="${product.url}">Ver en Amazon</a>`;
          await sendTelegramMessage(message);
        }

      } catch (error) {
        let extraInfo = '';
        try {
          const pageTitle = await page.title();
          extraInfo = ` (Page Title: "${pageTitle}")`;
        } catch (_) {}
        console.error(`Error fetching ${product.name}:`, error.message, extraInfo);
        logEntry += ` | ${product.name}: Error (${error.message}${extraInfo})`;
      }
    }

    logEntry += "\n";
    console.log(logEntry);
    fs.appendFileSync('diapers.txt', logEntry, { flag: 'a+' });
    try {
      fs.copyFileSync('diapers.txt', 'frontend/public/diapers.txt');
      console.log('Saved latest text logs to frontend/public/diapers.txt');
    } catch (err) {
      console.error('Error writing diapers.txt to frontend public:', err.message);
    }

    await browser.close();
  })();
}