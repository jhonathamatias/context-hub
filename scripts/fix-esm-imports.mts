import { access, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveSpecifier(
  fromFile: string,
  specifier: string,
): Promise<string> {
  if (!specifier.startsWith('.')) {
    return specifier;
  }

  if (extname(specifier) === '.js' || extname(specifier) === '.json') {
    return specifier;
  }

  const base = resolve(dirname(fromFile), specifier);
  if (await exists(`${base}.js`)) {
    return `${specifier}.js`;
  }

  if (await exists(join(base, 'index.js'))) {
    return specifier.endsWith('/')
      ? `${specifier}index.js`
      : `${specifier}/index.js`;
  }

  return specifier;
}

async function fixFile(file: string): Promise<void> {
  const source = await readFile(file, 'utf8');
  // Matches: from '...', import '...', export ... from '...'
  const pattern = /((?:from|import)\s+)(['"])(\.\.?\/[^'"]+)\2/g;
  let output = source;
  const pending: Array<{ full: string; prefix: string; quote: string; specifier: string }> =
    [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const [, prefix, quote, specifier] = match;
    if (!prefix || !quote || !specifier) {
      continue;
    }
    pending.push({ full: match[0], prefix, quote, specifier });
  }

  for (const item of pending) {
    const next = await resolveSpecifier(file, item.specifier);
    if (next === item.specifier) {
      continue;
    }
    output = output.replace(
      item.full,
      `${item.prefix}${item.quote}${next}${item.quote}`,
    );
  }

  if (output !== source) {
    await writeFile(file, output);
  }
}

async function walk(dir: string): Promise<void> {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) {
      await walk(path);
      continue;
    }
    if (path.endsWith('.js')) {
      await fixFile(path);
    }
  }
}

await walk(resolve('dist'));
console.log('Fixed ESM relative imports in dist/');
