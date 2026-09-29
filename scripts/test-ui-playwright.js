// Playwright test to check if Grupo B fields appear in the UI
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the app
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  console.log('Page loaded');
  
  // Check if the page title is correct
  const title = await page.title();
  console.log('Page title:', title);
  
  // Upload a PDF file
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles('/home/z/my-project/upload/91510905101.PDF');
  console.log('File selected');
  
  // Wait for extraction to complete (wait for the results tab to become active)
  await page.waitForTimeout(5000);
  
  // Check if we're on the results tab
  const resultsTab = await page.locator('[data-state="active"]').textContent().catch(() => 'N/A');
  console.log('Active tab:', resultsTab);
  
  // Take a screenshot
  await page.screenshot({ path: '/home/z/my-project/download/ui-test-screenshot.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Look for "Consumo em kWh (Grupo B)" text in the page
  const grupoBText = await page.locator('text=Consumo em kWh (Grupo B)').count();
  console.log('"Consumo em kWh (Grupo B)" elements found:', grupoBText);
  
  // Look for "Consumo (R$) (Grupo B)" text
  const grupoBValorText = await page.locator('text=Consumo (R$) (Grupo B)').count();
  console.log('"Consumo (R$) (Grupo B)" elements found:', grupoBValorText);
  
  // Look for the value "5.276,00" which should be the ConsumoGrupoB_kWh value
  const valorKWh = await page.locator('text=5.276,00').count();
  console.log('"5.276,00" elements found:', valorKWh);
  
  // Look for "6.910,68" which should be the ConsumoGrupoB_Valor value
  const valorRS = await page.locator('text=6.910,68').count();
  console.log('"6.910,68" elements found:', valorRS);
  
  // Get all text content from the page to debug
  const bodyText = await page.locator('body').innerText();
  const lines = bodyText.split('\n').filter(l => l.includes('Grupo B') || l.includes('5.276') || l.includes('6.910'));
  console.log('Relevant lines in page:', lines);
  
  await browser.close();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
