/**
 * Bundles the API for its container: dist/server.js (the service) and dist/release.js (the hde-migrate
 * job, which migrates and seeds). Workspace packages such as @hde/shared are bundled in; npm dependencies stay external and are
 * installed in the image, since firebase-admin and pg do not bundle cleanly.
 */
import {build} from 'esbuild';

await build({
  entryPoints: {server: 'src/server.ts', release: 'scripts/release.ts'},
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'external-npm-packages',
      setup(builder) {
        // Bare imports, except the workspace's own packages and its `#src/*` subpath imports.
        builder.onResolve({filter: /^[^./#]/}, ({path}) =>
          path.startsWith('@hde/') ? undefined : {path, external: true},
        );
      },
    },
  ],
});
