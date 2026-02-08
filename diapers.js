import fs from 'node:fs'
import puppeteer from 'puppeteer';

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

  const products = [
    { name: 'Dodot talla 1', count: 224, url: 'https://www.amazon.es/dp/B0976XNCQ5' },
    { name: 'Dodot talla 2', count: 198, url: 'https://www.amazon.es/dp/B0DJBYVG1Q' },
    { name: 'Lillydoo talla 1', count: 144, url: 'https://www.amazon.es/dp/B0F3P5TKJ1' },
    { name: 'Lillydoo talla 2', count: 204, url: 'https://www.amazon.es/dp/B0F3P56XRH' },
    { name: 'Nido capazo bebe', count: 1, url: 'https://www.amazon.es/dp/B0FNMS82XK' }
  ];

  // --- TELEGRAM CONFIGURATION ---
  const TELEGRAM_TOKEN = '8040504577:AAEtt_CZwVejmGzTx7mwgx5VYmDdLRnGfs8';
  const TELEGRAM_CHAT_ID = '-4644588323';
  const PRICE_THRESHOLD = 170;
  // -------------------------------

  const sendTelegramMessage = async (message) => {
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
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
  });
  const page = await browser.newPage();

  let logEntry = `${fecha}`;

  const csvFile = 'frontend/public/diapers.csv';
  if (!fs.existsSync(csvFile)) {
    // Ensure directory exists just in case
    const dir = 'frontend/public';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(csvFile, 'Fecha,Producto,Numero de Pañales,Precio,Precio por unidad\r\n');
  }

  for (const product of products) {
    try {
      await page.goto(product.url, { waitUntil: 'domcontentloaded' });
      const priceText = await page.$eval('.a-price-whole', el => el.textContent);
      const price = parseInt(priceText);
      const pricePerUnit = (price / product.count).toFixed(3);

      logEntry += ` ${product.name} (${product.count} pañales): ${priceText} por unidad : ${pricePerUnit}`;

      // Append to CSV with Windows line ending
      const csvLine = `"${fecha}","${product.name}",${product.count},${price},${pricePerUnit}\r\n`;
      fs.appendFileSync(csvFile, csvLine);

      // Telegram alert logic
      if (product.name === 'Nido capazo bebe' && price <= PRICE_THRESHOLD) {
        const message = `El <b>${product.name}</b> ha bajado a <b>${price}€</b>.\n\nEnlace: <a href="${product.url}">Amazon</a>`;
        await sendTelegramMessage(message);
      }

    } catch (error) {
      console.error(`Error fetching ${product.name}:`, error.message);
      logEntry += ` ${product.name}: Error`;
    }
  }

  logEntry += "\n";

  console.log(logEntry);
  await fs.appendFileSync('diapers.txt', logEntry, { flag: 'a+' });

  await browser.close();
})();