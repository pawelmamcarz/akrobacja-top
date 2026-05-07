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
  // rsync everything except large files in rolki/ that can't go to CF Pages
  execSync(
    `rsync -a \
      --exclude='rolki/Bungee extra.mp4' \
      --exclude='rolki/EXTRA.mov' \
      --exclude='rolki/SnapSave_AQNwWd*' \
      --exclude='rolki/SnapSave_AQM5M2*' \
      --exclude='rolki/FastDL.*' \
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
