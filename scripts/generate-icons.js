const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_ICON = path.resolve(__dirname, '../assets/app-icon.png');
const RES_DIR = path.resolve(__dirname, '../android/app/src/main/res');

const MIPMAP_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generateIcons() {
  for (const [folder, size] of Object.entries(MIPMAP_SIZES)) {
    const dir = path.join(RES_DIR, folder);
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

    console.log(`${folder}: ${size}x${size}`);
  }

  console.log('\nDone! All Android launcher icons generated from app-icon.png');
}

generateIcons().catch(console.error);
