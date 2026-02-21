#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const WIKI_URL = 'https://dsp-wiki.com/Items';
const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');

async function fetchHtml(url) {
  console.log(`Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function extractIconsFromSection(dom, sectionId) {
  const document = dom.window.document;
  const sectionHeading = document.querySelector(`#${sectionId}`);
  
  if (!sectionHeading) {
    throw new Error(`Section "${sectionId}" not found`);
  }
  
  // Find the next section element after the heading
  let currentElement = sectionHeading.closest('h2, section');
  if (!currentElement) {
    currentElement = sectionHeading.parentElement;
  }
  
  // Find the section that contains the table
  let section = currentElement;
  if (section.tagName === 'H2') {
    section = section.nextElementSibling;
  }
  
  while (section && !section.querySelector('table')) {
    section = section.nextElementSibling;
  }
  
  if (!section) {
    throw new Error(`Could not find table for section "${sectionId}"`);
  }
  
  const table = section.querySelector('table');
  if (!table) {
    throw new Error(`No table found in section "${sectionId}"`);
  }
  
  const items = [];
  const rows = table.querySelectorAll('tr');
  
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td');
    cells.forEach((cell, colIndex) => {
      const container = cell.querySelector('.item_icon_container');
      if (!container) return;
      
      const link = container.querySelector('a[href^="/"]');
      const img = container.querySelector('img');
      
      if (link && img) {
        const imageUrl = img.getAttribute('src');
        const imageName = img.getAttribute('alt');
        const linkHref = link.getAttribute('href');
        
        items.push({
          row: rowIndex + 1,
          col: colIndex + 1,
          imageName: imageName,
          imageUrl: imageUrl,
          link: linkHref
        });
      }
    });
  });
  
  return items;
}

async function main() {
  try {
    console.log('Starting icon extraction from DSP Wiki...\n');
    
    // Ensure assets directory exists
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
      console.log(`Created directory: ${ASSETS_DIR}`);
    }
    
    // Fetch and parse HTML
    const html = await fetchHtml(WIKI_URL);
    const dom = new JSDOM(html);
    
    // Extract Components
    console.log('\nExtracting Components...');
    const components = extractIconsFromSection(dom, 'Components');
    console.log(`  Found ${components.length} components`);
    
    const componentsPath = path.join(ASSETS_DIR, 'components.json');
    fs.writeFileSync(componentsPath, JSON.stringify(components, null, 2));
    console.log(`  Written to: ${componentsPath}`);
    
    // Extract Buildings
    console.log('\nExtracting Buildings...');
    const buildings = extractIconsFromSection(dom, 'Buildings');
    console.log(`  Found ${buildings.length} buildings`);
    
    const buildingsPath = path.join(ASSETS_DIR, 'buildings.json');
    fs.writeFileSync(buildingsPath, JSON.stringify(buildings, null, 2));
    console.log(`  Written to: ${buildingsPath}`);
    
    console.log('\n✓ Icon extraction complete!');
    console.log(`\nSummary:`);
    console.log(`  - Components: ${components.length}`);
    console.log(`  - Buildings: ${buildings.length}`);
    console.log(`  - Total: ${components.length + buildings.length}`);
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

main();
