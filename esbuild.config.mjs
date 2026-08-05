import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import fs from 'node:fs/promises';

const rawTextImports = {
  name: 'cimu-raw-text',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, async ({ path, resolveDir, kind }) => {
      const request = path.slice(0, -4);
      const resolution = await build.resolve(request, { resolveDir, kind });
      return resolution.errors.length > 0
        ? { errors: resolution.errors }
        : { path: resolution.path, namespace: 'cimu-raw-text' };
    });
    build.onLoad({ filter: /.*/, namespace: 'cimu-raw-text' }, async ({ path }) => ({
      contents: await fs.readFile(path, 'utf8'),
      loader: 'text'
    }));
  }
};

const production = process.argv[2] === 'production';
const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/state', '@codemirror/view', 'node:*', ...builtins],
  format: 'cjs',
  target: 'es2018',
  platform: 'browser',
  plugins: [rawTextImports],
  sourcemap: production ? false : 'inline',
  minify: production,
  outfile: 'main.js',
  logLevel: 'info'
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
