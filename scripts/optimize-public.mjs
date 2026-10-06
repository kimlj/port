import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { transform } from 'esbuild';

/* Readable source stays untouched. Only the allowlisted public output is minified. */
export async function optimizePublic(out) {
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) { await visit(file); continue; }
      const extension = extname(file);
      if (!['.js', '.css', '.html'].includes(extension)) continue;
      const source = await readFile(file, 'utf8');
      let result;
      if (extension === '.js' || extension === '.css') {
        const transformed = await transform(source, { loader: extension === '.js' ? 'js' : 'css', minify: true, target: 'es2020', legalComments: 'inline' });
        if (transformed.warnings.length) throw new Error(file + ': ' + transformed.warnings.map(w => w.text).join('; '));
        result = transformed.code;
      } else {
        result = source.replace(/\r\n/g, '\n');
        if (entry.name === 'index.html') {
          const fonts = await readFile(join(out, 'assets', 'fonts.css'), 'utf8');
          result = result.replace('<link rel="stylesheet" href="assets/fonts.css">', '<style>' + fonts + '</style>');
        }
        result = result.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
        for (const block of [...result.matchAll(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1>/g)]) {
          if (block[1] === 'script' && (/\bsrc=|application\/ld\+json/.test(block[2]) || !block[3].trim())) continue;
          const transformed = await transform(block[3], {
            loader: block[1] === 'style' ? 'css' : 'js',
            minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false,
            target: 'es2020', legalComments: 'inline'
          });
          if (transformed.warnings.length) throw new Error(file + ': invalid inline ' + block[1] + ': ' + transformed.warnings.map(w => w.text).join('; '));
          const wrapped = '<' + block[1] + block[2] + '>' + transformed.code + '</' + block[1] + '>';
          result = result.replace(block[0], wrapped);
        }
        result = result.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
      }
      await writeFile(file, result);
      console.log('  minify ' + file.slice(out.length + 1) + ': ' + Buffer.byteLength(source) + ' -> ' + Buffer.byteLength(result) + ' B');
    }
  }
  await visit(out);
}
