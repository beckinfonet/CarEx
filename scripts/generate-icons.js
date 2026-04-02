const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_ICON = path.resolve(__dirname, '../assets/app-icon.png');

// ─── Android ────────────────────────────────────────────────────────
const ANDROID_RES = path.resolve(__dirname, '../android/app/src/main/res');
const ANDROID_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// ─── iOS ────────────────────────────────────────────────────────────
const IOS_APPICONSET = path.resolve(
  __dirname,
  '../ios/carEx/Images.xcassets/AppIcon.appiconset'
);

function getIosSizes() {
  const contentsPath = path.join(IOS_APPICONSET, 'Contents.json');
  const contents = JSON.parse(fs.readFileSync(contentsPath, 'utf-8'));
  const unique = new Set();
  for (const img of contents.images) {
    const size = parseInt(img['expected-size'] || img.filename, 10);
    if (size) unique.add(size);
  }
  return [...unique].sort((a, b) => a - b);
}

async function generateAndroid() {
  console.log('=== Android launcher icons ===');
  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const dir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(dir, { recursive: true });

    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    const roundMask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
    );
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`  ${folder}: ${size}x${size}`);
  }
}

async function generateIos() {
  console.log('=== iOS app icons ===');
  fs.mkdirSync(IOS_APPICONSET, { recursive: true });
  const sizes = getIosSizes();
  for (const size of sizes) {
    await sharp(SOURCE_ICON)
      .resize(size, size)
      .png()
      .toFile(path.join(IOS_APPICONSET, `${size}.png`));
  }
  console.log(`  Generated ${sizes.length} sizes: ${sizes.join(', ')}`);
}

async function main() {
  await generateAndroid();
  await generateIos();
  console.log('\nDone!');
}

main().catch(console.error);
