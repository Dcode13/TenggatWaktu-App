import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/icon.svg', import.meta.url), 'utf8');
const foreground = source.replace('<rect width="1024" height="1024" fill="#101411"/>', '');
const render = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(`../assets/${file}`, import.meta.url).pathname);
await Promise.all([
  render(source, 1024, 'icon.png'),
  render(source, 48, 'favicon.png'),
  render(foreground, 1024, 'android-icon-foreground.png'),
  render(foreground.replaceAll('#85DE99', '#FFFFFF'), 1024, 'android-icon-monochrome.png'),
]);
