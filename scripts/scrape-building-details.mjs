#!/usr/bin/env node
/**
 * DSP Wiki Building Details Scraper
 * 
 * Scrapes building details from the DSP Wiki and saves to building-details.json
 * Usage: node scrape-building-details.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'https://dsp-wiki.com';
const BUILDINGS_FILE = path.join(process.cwd(), 'src/assets/buildings.json');
const OUTPUT_FILE = path.join(process.cwd(), 'src/assets/building-details.json');
const REQUEST_DELAY = 1000; // Be nice to the server (ms)

async function fetchPage(url) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.log(`  Error fetching ${url}: ${error.message}`);
    return null;
  }
}

function parseItemPanel(html) {
  const $ = cheerio.load(html);
  
  const panel = $('.item_panel').first();
  if (!panel.length) {
    return null;
  }
  
  // Extract basic info
  const name = panel.find('.tech_header .tt_glow').first().text().trim() || null;
  const category = panel.find('.tt_category').first().text().trim() || null;
  const description = panel.find('.tt_desc').first().text().trim() || null;
  
  // Extract stats from table
  const stats = {};
  const infoTable = panel.find('.tt_info_table').first();
  if (infoTable.length) {
    infoTable.find('tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim();
        const value = $(cells[cells.length - 1]).text().trim(); // Value is in last cell
        if (label && value) {
          stats[label] = value;
        }
      }
    });
  }
  
  return {
    name,
    category,
    description,
    stats
  };
}

async function scrapeBuilding(building) {
  const link = building.link || '';
  if (!link) {
    return null;
  }
  
  // Handle relative links
  const url = link.startsWith('/') ? `${BASE_URL}${link}` : link;
  
  console.log(`Scraping: ${building.imageName || 'Unknown'} (${url})`);
  
  const html = await fetchPage(url);
  if (!html) {
    return null;
  }
  
  const details = parseItemPanel(html);
  if (!details) {
    console.log(`  Warning: No item_panel found on page`);
    return null;
  }
  
  // Add metadata
  details.wikiUrl = url;
  details.imageName = building.imageName;
  
  // Show what we found
  console.log(`  ✓ Category: ${details.category}`);
  console.log(`  ✓ Stats: ${Object.keys(details.stats).length} fields`);
  
  return details;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('DSP Wiki Building Details Scraper');
  console.log('='.repeat(60));
  
  // Load buildings
  let buildings;
  try {
    const data = await fs.readFile(BUILDINGS_FILE, 'utf-8');
    buildings = JSON.parse(data);
  } catch (error) {
    console.error(`Error: ${BUILDINGS_FILE} not found or invalid`);
    process.exit(1);
  }
  
  console.log(`\nFound ${buildings.length} buildings to scrape\n`);
  
  // Scrape each building
  const results = [];
  const errors = [];
  
  for (let i = 0; i < buildings.length; i++) {
    const building = buildings[i];
    console.log(`\n[${i + 1}/${buildings.length}] `);
    
    const details = await scrapeBuilding(building);
    if (details) {
      results.push(details);
    } else {
      errors.push(building.imageName || `Building #${i + 1}`);
    }
    
    // Be nice to the server
    if (i < buildings.length - 1) {
      await sleep(REQUEST_DELAY);
    }
  }
  
  // Save results
  console.log(`\n${'='.repeat(60)}`);
  console.log('Scraping Complete!');
  console.log(`${'='.repeat(60)}`);
  console.log(`Successfully scraped: ${results.length} buildings`);
  console.log(`Failed: ${errors.length} buildings`);
  
  if (errors.length > 0) {
    console.log(`\nFailed buildings:`);
    errors.forEach(name => console.log(`  - ${name}`));
  }
  
  // Create output structure
  const output = {
    scraped_at: new Date().toISOString(),
    total_buildings: buildings.length,
    successful: results.length,
    failed: errors.length,
    buildings: results
  };
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  
  // Save to file
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`\nResults saved to: ${OUTPUT_FILE}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
