#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');
const IMAGES_DIR = path.join(ASSETS_DIR, 'images');

// Manual mappings: wiki icon name -> item name (without Icon_ prefix and .png suffix)
const WIKI_TO_ITEM_MAPPINGS = {
  'Spiniform_Stalagmite_Crystal': 'Stalagmite_Crystal',
  'High-Purity_Silicon': 'High-purity_Silicon',
  'Super-Magnetic_Ring': 'Super-magnetic_Ring',
  'Logistics_Vessel': 'Interstellar_Logistics_Vessel',
  'Storage_Mk.I': 'Depot_Mk.I',
  'Storage_Mk.II': 'Depot_Mk.II',
  'Full_Accumulator': 'Accumulator_(full)',
};

function transformThumbUrlToFull(thumbUrl) {
  // Transform URL from:
  // https://media.dsp-wiki.com/thumb/f/fc/Icon_Iron_Ore.png/42px-Icon_Iron_Ore.png
  // to:
  // https://media.dsp-wiki.com/f/fc/Icon_Iron_Ore.png
  
  // Remove /thumb/ prefix
  let fullUrl = thumbUrl.replace('/thumb/', '/');
  
  // Remove resolution suffix (everything after the last / before the end)
  // The pattern is: .../Icon_Name.png/{resolution}px-Icon_Name.png
  const lastSlashIndex = fullUrl.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    fullUrl = fullUrl.substring(0, lastSlashIndex);
  }
  
  return fullUrl;
}

function getWikiIconName(imageName) {
  // Extract icon name from "Icon Iron Ore.png" -> "Iron_Ore"
  return imageName.replace('Icon ', '').replace('.png', '').replace(/ /g, '_');
}

function getTargetFilename(wikiIconName) {
  // Check if there's a mapping to item name
  const itemName = WIKI_TO_ITEM_MAPPINGS[wikiIconName] || wikiIconName;
  return `Icon_${itemName}.png`;
}

async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
}

async function downloadImagesFromJson(jsonFile, category) {
  const jsonPath = path.join(ASSETS_DIR, jsonFile);
  
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`${jsonPath} not found. Run 'npm run update:icons' first.`);
  }
  
  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`\nDownloading ${category} images...`);
  console.log(`  Total: ${items.length} items`);
  
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;
  let renamed = 0;
  
  for (const item of items) {
    const fullUrl = transformThumbUrlToFull(item.imageUrl);
    const wikiIconName = getWikiIconName(item.imageName);
    const targetFilename = getTargetFilename(wikiIconName);
    const filepath = path.join(IMAGES_DIR, targetFilename);
    
    // Track renames
    const originalFilename = item.imageName.replace(/ /g, '_');
    if (originalFilename !== targetFilename) {
      renamed++;
      if (renamed <= 5) {
        console.log(`  → Renaming: ${originalFilename} -> ${targetFilename}`);
      }
    }
    
    // Skip if already exists
    if (fs.existsSync(filepath)) {
      skipped++;
      continue;
    }
    
    try {
      await downloadImage(fullUrl, filepath);
      downloaded++;
      
      // Progress indicator every 10 items
      if (downloaded % 10 === 0) {
        process.stdout.write('.');
      }
    } catch (error) {
      errors++;
      console.error(`\n  ✗ Failed: ${targetFilename} - ${error.message}`);
    }
  }
  
  console.log(`\n  Downloaded: ${downloaded}`);
  console.log(`  Renamed: ${renamed}`);
  console.log(`  Skipped (exists): ${skipped}`);
  if (errors > 0) {
    console.log(`  Errors: ${errors}`);
  }
  
  return { downloaded, renamed, skipped, errors };
}

async function main() {
  try {
    console.log('Starting image download from DSP Wiki...');
    console.log('Images will be saved with names matching ItemProtoSet...\n');
    
    // Ensure images directory exists
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
      console.log(`Created directory: ${IMAGES_DIR}`);
    }
    
    // Download Components
    const componentsResult = await downloadImagesFromJson('components.json', 'Components');
    
    // Download Buildings
    const buildingsResult = await downloadImagesFromJson('buildings.json', 'Buildings');
    
    console.log('\n✓ Image download complete!');
    console.log(`\nSummary:`);
    console.log(`  - Components: ${componentsResult.downloaded} downloaded, ${componentsResult.renamed} renamed, ${componentsResult.skipped} skipped`);
    console.log(`  - Buildings: ${buildingsResult.downloaded} downloaded, ${buildingsResult.renamed} renamed, ${buildingsResult.skipped} skipped`);
    console.log(`  - Total downloaded: ${componentsResult.downloaded + buildingsResult.downloaded}`);
    console.log(`  - Total renamed: ${componentsResult.renamed + buildingsResult.renamed}`);
    console.log(`  - Total skipped: ${componentsResult.skipped + buildingsResult.skipped}`);
    if (componentsResult.errors + buildingsResult.errors > 0) {
      console.log(`  - Total errors: ${componentsResult.errors + buildingsResult.errors}`);
    }
    
    console.log('\nRun `npm run check:mappings` to verify all items have icons.');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

main();
