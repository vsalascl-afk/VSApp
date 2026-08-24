import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generatePDF() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const htmlPath = resolve(__dirname, 'generate-pdf-caracteristicas.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  
  const outputPath = resolve(__dirname, 'public/ElecData_Pro_Presentacion_Comite_Financiero.pdf');
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  
  console.log(`PDF generado exitosamente: ${outputPath}`);
  await browser.close();
}

generatePDF().catch(console.error);