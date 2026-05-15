#!/usr/bin/env node
// Deploy helper: copies public/ to a temp dir, skipping large video files
// that exceed the 25 MiB Cloudflare Pages limit, then runs wrangler deploy.
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'akro-deploy-'));

try {
  // rsync everything except:
  //  - large videos that exceed the 25 MiB Cloudflare Pages file limit
  //  - the original JPG/PNG hero photos whose WebP equivalents are now what the
  //    HTML references. Keeping originals wastes ~75 MB of upload per deploy and
  //    serves them publicly for crawlers that ignore content-type negotiation.
  execSync(
    `rsync -a \
      --exclude='rolki/Bungee extra.mp4' \
      --exclude='rolki/EXTRA.mov' \
      --exclude='rolki/SnapSave_AQNwWd*' \
      --exclude='rolki/SnapSave_AQM5M2*' \
      --exclude='rolki/FastDL.*' \
      --exclude='hero-takeoff.jpg' \
      --exclude='pilot-cockpit.jpg' \
      --exclude='cockpit-closeup.jpg' \
      --exclude='speks-flight.jpg' \
      --exclude='speks-city.jpg' \
      --exclude='samolot-top-web.jpg' \
      --exclude='mamcarz.jpg' \
      --exclude='kula.jpg' \
      --exclude='przewodnik.png' \
      --exclude='przewodnik-briefing.png' \
      --exclude='przewodnik-fcl800.png' \
      public/ ${tmp}/`,
    { cwd: root, stdio: 'inherit' }
  );

  execSync(
    `npx wrangler pages deploy ${tmp} --commit-dirty=true`,
    { cwd: root, stdio: 'inherit' }
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
