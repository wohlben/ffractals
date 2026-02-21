#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');
const IMAGES_DIR = path.join(ASSETS_DIR, 'images');

// Items that have different icon names on wiki vs item names in protosets
// These are saved with item names (the "corrected" names)
const SPECIAL_ITEM_NAMES = [
  'Stalagmite Crystal',
  'High-purity Silicon', 
  'Super-magnetic Ring',
  'Interstellar Logistics Vessel',
  'Depot Mk.I',
  'Depot Mk.II',
  'Accumulator (full)',
];

function getExpectedIconName(itemName) {
  // All icons follow the pattern: Icon_${name_with_underscores}.png
  // Spaces and special characters are replaced with underscores
  const sanitized = itemName.replace(/ /g, '_');
  return `Icon_${sanitized}.png`;
}

function checkItemIcons() {
  console.log('Checking item icon mappings...\n');
  
  // Load protosets.json
  const protosetsPath = path.join(ASSETS_DIR, 'protosets.json');
  if (!fs.existsSync(protosetsPath)) {
    throw new Error(`${protosetsPath} not found. Run 'npm run update:protosets' first.`);
  }
  
  const protosets = JSON.parse(fs.readFileSync(protosetsPath, 'utf8'));
  const items = protosets.ItemProtoSet?.dataArray || [];
  
  console.log(`Total items in ItemProtoSet: ${items.length}`);
  
  // Load all downloaded image names
  const availableImages = fs.readdirSync(IMAGES_DIR);
  const availableImagesSet = new Set(availableImages);
  
  console.log(`Available images: ${availableImages.length}\n`);
  
  // Check each item
  const matched = [];
  const unmatched = [];
  const itemIconMap = {}; // ID -> icon mapping
  
  for (const item of items) {
    const expectedIcon = getExpectedIconName(item.Name);
    const exists = availableImagesSet.has(expectedIcon);
    
    if (exists) {
      matched.push({
        id: item.ID,
        name: item.Name,
        icon: expectedIcon,
        isSpecial: SPECIAL_ITEM_NAMES.includes(item.Name)
      });
      itemIconMap[item.ID] = {
        name: item.Name,
        icon: expectedIcon,
        iconPath: `assets/images/${expectedIcon}`
      };
    } else {
      unmatched.push({
        id: item.ID,
        name: item.Name,
        expectedIcon: expectedIcon
      });
    }
  }
  
  // Report results
  console.log('✓ Matched items:', matched.length);
  console.log('✗ Unmatched items:', unmatched.length);
  console.log(`Coverage: ${((matched.length / items.length) * 100).toFixed(1)}%\n`);
  
  if (unmatched.length > 0) {
    console.log('Unmatched items:');
    unmatched.forEach(item => {
      console.log(`  - ${item.name} (ID: ${item.id}) -> Expected: ${item.expectedIcon}`);
    });
    
    console.log('\nMissing icon files:');
    const missingFiles = [...new Set(unmatched.map(u => u.expectedIcon))];
    missingFiles.forEach(file => {
      const count = unmatched.filter(u => u.expectedIcon === file).length;
      console.log(`  - ${file} (${count} items)`);
    });
  }
  
  // Check if there are extra images not mapped to items
  const usedIcons = new Set(matched.map(m => m.icon));
  const extraImages = availableImages.filter(img => !usedIcons.has(img));
  
  if (extraImages.length > 0) {
    console.log(`\nExtra images not mapped to items: ${extraImages.length}`);
    extraImages.slice(0, 10).forEach(img => console.log(`  - ${img}`));
    if (extraImages.length > 10) {
      console.log(`  ... and ${extraImages.length - 10} more`);
    }
  }
  
  // Save mapping file
  const mappingPath = path.join(ASSETS_DIR, 'item-icon-mappings.json');
  fs.writeFileSync(mappingPath, JSON.stringify({
    version: protosets.version,
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    mappedItems: matched.length,
    coverage: `${((matched.length / items.length) * 100).toFixed(1)}%`,
    specialItems: SPECIAL_ITEM_NAMES,
    mappings: itemIconMap
  }, null, 2));
  console.log(`\n✓ Saved mapping to: ${mappingPath}`);
  
  return {
    total: items.length,
    matched: matched.length,
    unmatched: unmatched.length,
    coverage: (matched.length / items.length) * 100,
    itemIconMap
  };
}

async function main() {
  try {
    const result = checkItemIcons();
    
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total items: ${result.total}`);
    console.log(`With icons: ${result.matched}`);
    console.log(`Missing: ${result.unmatched}`);
    console.log(`Coverage: ${result.coverage.toFixed(1)}%`);
    
    if (result.unmatched > 0) {
      console.log('\nNote: Unmatched items need icon files added manually.');
    }
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

main();
