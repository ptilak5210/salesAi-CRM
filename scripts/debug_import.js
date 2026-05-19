import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('http://localhost:3000');
    
    console.log('Typing login...');
    await page.type('input[type="email"]', 'testing1@gmail.com');
    await page.type('input[type="password"]', 'testing123');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for Dashboard...');
    await page.waitForSelector('text/Leads', { timeout: 10000 });
    
    console.log('Going to Leads...');
    await page.click('text/Leads');
    
    console.log('Waiting for Import button...');
    await page.waitForSelector('text/Import', { timeout: 10000 });
    
    console.log('Clicking Import...');
    await page.click('text/Import');
    
    await new Promise(r => setTimeout(r, 2000));
    console.log('Done.');
    
    await browser.close();
})();
