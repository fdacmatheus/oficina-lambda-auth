import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Cada handler vira um zip independente: a Lambda de token precisa do driver
// do PostgreSQL, a authorizer nao, e manter os artefatos separados reduz o
// cold start de quem e invocado em toda requisicao protegida.
const handlers = ['token', 'authorizer'];

rmSync('build', { recursive: true, force: true });

for (const nome of handlers) {
  const saida = `build/${nome}`;
  mkdirSync(saida, { recursive: true });

  await build({
    entryPoints: [`src/handlers/${nome}.ts`],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: `${saida}/index.js`,
    minify: true,
    sourcemap: false,
    // O runtime Node da Lambda ja fornece o AWS SDK v3.
    external: ['@aws-sdk/*'],
  });

  execSync(`cd ${saida} && zip -qr ../${nome}.zip .`, { stdio: 'inherit' });
  console.log(`empacotado: build/${nome}.zip`);
}
