const cp = require(`child_process`);
const crypto = require(`crypto`);
const fs = require(`fs`);
const https = require(`https`);
const path = require(`path`);
const semver = require(`semver`);

const TS_REPO = `/tmp/ts-repo`;
const TS_REPO_SPAWN = {cwd: TS_REPO};

const TMP_DIR = `/tmp/ts-builds`;

const IGNORED_VERSIONS = new Set([
  `3.3.3333`,
  `3.7.0-beta`,
  `3.9.0-beta`,
  `4.0.0-beta`,
  `4.3.0-beta`,
  `4.4.0-beta`,
  // Broken publish - missing files
  `4.9.0-beta`,
]);

const SLICES = [
  {
    from: `5d50de3`,
    to: `426f5a7`,
    onto: `e39bdc3`,
    range: `>=3.2 <3.5`,
  },
  {
    from: `5d50de3`,
    to: `426f5a7`,
    onto: `cf7b2d4`,
    range: `>=3.5 <=3.6`,
  },
  {
    from: `5d50de3`,
    to: `426f5a7`,
    onto: `cda54b8`,
    range: `>3.6 <3.7`,
  },
  {
    from: `5d50de3`,
    to: `2f85932`,
    onto: `e39bdc3`,
    range: `>=3.7 <3.9`,
  },
  {
    from: `5d50de3`,
    to: `3af06df`,
    onto: `551f0dd`,
    range: `>=3.9 <4.0`,
  },
  {
    from: `6dbdd2f`,
    to: `6dbdd2f`,
    onto: `56865f7`,
    range: `>=4.0 <4.1`,
  },
  {
    from: `746d79b`,
    to: `746d79b`,
    onto: `69972a3`,
    range: `>=4.1 <4.2`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.2
  {
    from: `8e0e8703b9c95013aec7819e4593d099cdf7763a`,
    to: `178a67b4663d80b0fcbea542e7255b4499b51708`,
    onto: `bfc55b5762443c37ecdef08a3b5a4e057b4d1e85`,
    range: `>=4.2 <4.3`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.3
  {
    from: `530aad19e4ac19d35cb6b200168c91ce86cb0050`,
    to: `ffa54c5a104e7940b5c23666ddffbf44878f9d9f`,
    onto: `28e3e6ff2f49f1dbf06d31809ec73dbe42f1aa63`,
    range: `>=4.3 <4.4`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.4
  {
    from: `793bfe32745bf6797924354b0fd5be62cf01950c`,
    to: `20ffca2f3c48591c971e6606a55b7b1820d8a64f`,
    onto: `a10409ccaa3604790dc45f52ef0402eb49015dcf`,
    range: `>=4.4 <4.5`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.5
  {
    from: `79fe5d206f89e5f1585807bdcd7feeb567a69646`,
    to: `fff89a12766fa485e35b1c65d8631d109c4e2c0e`,
    onto: `7893f689fedcfe28a499d119d34844840bce9160`,
    range: `>=4.5.2 <4.6`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.6
  {
    from: `fbec717ef33fc2db5791f2a1d5f9a315e293a50a`,
    to: `fbec717ef33fc2db5791f2a1d5f9a315e293a50a`,
    onto: `83efc9f0d646bf86a3469e00c5ef5e4f7ab7cb95`,
    range: `>=4.6.1-rc <4.7`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.7
  {
    from: `cd8d000510ed2d2910e0ebaa903a51adda546a0a`,
    to: `cd8d000510ed2d2910e0ebaa903a51adda546a0a`,
    onto: `6e62273fa1e7469b89b589667c2c233789c62176`,
    range: `>=4.7.0-beta <4.8`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.8.0-beta
  {
    from: `3287098f4785fd652112beadf3b33a960fcd19aa`,
    to: `3287098f4785fd652112beadf3b33a960fcd19aa`,
    onto: `9a09c37878a45b06994485fdb510eb4d24587dcb`,
    range: `>=4.8.0-beta <4.8.1-rc`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.8-stable
  {
    from: `623a7ac5aa49250155d39e604b09b4d015468a9c`,
    to: `30840e0c2ad8e115c518f87379b7cb55fdf77f03`,
    onto: `60b5167a2a7015759d048cdd4655d1f66a8416a2`,
    range: `>=4.8.1-rc <4.8.4`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.8
  {
    from: `d3747e92c3cd2d1f98739382c14226a725df38fd`,
    to: `5b9a74243e47db6113e857eabe5d26589fa0b64f`,
    onto: `a614119c1921ca61d549a7eee65c0b8c69c28752`,
    range: `>=4.8.4 <4.9.1-beta`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.9-beta
  {
    from: `69c84aacfcea603c4d74721366cdcbbebd1c1681`,
    to: `18b67922d3dcc5215541a38bf6417972270bf60f`,
    onto: `549b5429d4837344e8c99657109bb6538fd2dbb5`,
    range: `>=4.9.1-beta <4.9.2-rc`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.9-rc
  {
    from: `5613f8d8e30dfa9fb3da15e2b8432ed7e2347a12`,
    to: `d3a8a86ce4774d607c5a4a225cc5b59b1f96f42f`,
    onto: `107f832b80df2dc97748021cb00af2b6813db75b`,
    range: `>=4.9.2-rc <4.9.4`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-4.9
  {
    from: `a0859a75a408ec95222a3f0175ba0644d60396f1`,
    to: `2b8a9b1c21a6d2c0aa26437c2636414be950aa79`,
    onto: `e2868216f637e875a74c675845625eb15dcfe9a2`,
    range: `>=4.9.4 <5.0.0-beta`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-5.0-beta
  {
    from: `65bff6fadce4736bb9a77213ba8016f1ac7d25e5`,
    to: `65bff6fadce4736bb9a77213ba8016f1ac7d25e5`,
    onto: `dcad07ffd29854e2b93a86da0ba197f6eec21698`,
    range: `>=5.0.0-beta <5.0.1-rc`,
  },
  // https://github.com/merceyz/TypeScript/tree/merceyz/pnp-5.0
  {
    from: `2c85874875fdf1f1182733b99afe47604915bfec`,
    to: `2c85874875fdf1f1182733b99afe47604915bfec`,
    onto: `89515ce7e31d0bfaef776ac25929a78015cceb82`,
    range: `>=5.0.1-rc`,
  },
];

async function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (!(res.statusCode >= 200 && res.statusCode < 300))
        throw new Error(`Failed to fetch ${url}`);

      const chunks = [];

      res.on(`error`, err => {
        reject(err);
      });

      res.on(`data`, chunk => {
        chunks.push(chunk);
      });

      res.on(`end`, () => {
        resolve(Buffer.concat(chunks));
      });
    });

    req.on(`error`, err => {
      reject(err);
    });
  });
}

async function execFile(binary, args, {checkExitCode = true, ...opts} = {}) {
  console.log(`${binary} ${args.join(` `)}`);

  return new Promise((resolve, reject) => {
    const child = cp.spawn(binary, args, {
      ...opts,
      env: {
        ...process.env,
        NODE_OPTIONS: undefined,
      },
    });

    const outChunks = [];
    const allChunks = [];

    child.stdout.on(`data`, chunk => {
      outChunks.push(chunk);
      allChunks.push(chunk);
    });

    child.stderr.on(`data`, chunk => {
      allChunks.push(chunk);
    });

    child.on(`error`, err => {
      err.message += `\n\n${Buffer.concat(allChunks).toString()}\n`;
      reject(err);
    });

    child.on(`close`, code => {
      if (code === 0 || !checkExitCode) {
        resolve(Buffer.concat(outChunks));
      } else {
        reject(new Error(`The process exited\n\n${Buffer.concat(allChunks).toString()}\n`));
      }
    });
  });
}

let relevantVersions;

async function fetchVersions(range) {
  if (typeof relevantVersions === `undefined`) {
    const data = await fetch(`https://registry.yarnpkg.com/typescript`);
    const allVersions = Object.keys(JSON.parse(data.toString()).versions);

    relevantVersions = [];

    for (const version of allVersions) {
      if (IGNORED_VERSIONS.has(version))
        continue;

      const pre = semver.prerelease(version);
      if (pre && pre[0] !== `beta` && pre[0] !== `rc`)
        continue;

      relevantVersions.push(version);
    }
  }

  const versions = [];

  for (const version of relevantVersions) {
    const parsed = semver.parse(version);

    const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    if (!semver.satisfies(base, range))
      continue;

    versions.push(version);
  }

  return versions;
}

async function cloneRepository() {
  if (!fs.existsSync(TS_REPO)) {
    await execFile(`git`, [`clone`, `https://github.com/arcanis/typescript`, TS_REPO]);
    await execFile(`git`, [`remote`, `add`, `upstream`, `https://github.com/microsoft/typescript`], TS_REPO_SPAWN);
    await execFile(`git`, [`remote`, `add`, `upstream2`, `https://github.com/merceyz/typescript`], TS_REPO_SPAWN);
  }

  try {
    await execFile(`git`, [`cherry-pick`, `--abort`], TS_REPO_SPAWN);
  } catch {}

  await execFile(`git`, [`config`, `user.email`, `you@example.com`], TS_REPO_SPAWN);
  await execFile(`git`, [`config`, `user.name`, `Your Name`], TS_REPO_SPAWN);

  await execFile(`git`, [`fetch`, `origin`], TS_REPO_SPAWN);
  await execFile(`git`, [`fetch`, `upstream`], TS_REPO_SPAWN);
  await execFile(`git`, [`fetch`, `upstream2`], TS_REPO_SPAWN);
}

async function resetGit(hash) {
  await execFile(`git`, [`reset`, `--hard`, hash], TS_REPO_SPAWN);
  await execFile(`git`, [`clean`, `-df`], TS_REPO_SPAWN);

  if (fs.existsSync(path.join(TS_REPO, `package-lock.json`))) {
    await execFile(`npm`, [`install`], TS_REPO_SPAWN);
  } else {
    const date = await execFile(`git`, [`show`, `-s`, `--format=%ci`], TS_REPO_SPAWN);
    await execFile(`npm`, [`install`, `--before`, date.toString().trim()], TS_REPO_SPAWN);
  }
}

async function buildRepository({from, to, onto}) {
  const code = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, `0`);
  const tmpDir = path.join(TMP_DIR, `${code}`);

  await resetGit(onto);

  if (to) {
    let isAncestor;
    try {
      await execFile(`git`, [`merge-base`, `--is-ancestor`, onto, to], TS_REPO_SPAWN);
      isAncestor = true;
    } catch {
      isAncestor = false;
    }

    if (isAncestor) {
      await execFile(`git`, [`merge`, `--no-edit`, to], TS_REPO_SPAWN);
    } else {
      await execFile(`git`, [`cherry-pick`, `${from}^..${to}`], TS_REPO_SPAWN);
    }
  }

  await execFile(fs.existsSync(`${TS_REPO}/node_modules/.bin/hereby`) ? `./node_modules/.bin/hereby` : `./node_modules/.bin/gulp`, [`local`, `LKG`], TS_REPO_SPAWN);

  // It seems that in some circumstances the build can produce incorrect artifacts. When
  // that happens, the final binary is very small. We try to detect that.
  const stat = await fs.promises.stat(path.join(TS_REPO, `lib/typescript.js`));
  if (stat.size < 100000)
    throw new Error(`Something is wrong; typescript.js got generated with a stupid size`);

  await fs.promises.mkdir(tmpDir, {recursive: true});
  await execFile(`cp`, [`-r`, `lib`, tmpDir], TS_REPO_SPAWN);

  await execFile(`rm`, [`-rf`, `lib`], TS_REPO_SPAWN);
  await execFile(`git`, [`reset`, `--hard`], TS_REPO_SPAWN);

  return tmpDir;
}

async function run({from, to, onto, range}) {
  const hash = crypto
    .createHash(`md5`)
    .update(JSON.stringify({from, to, onto}))
    .digest(`hex`);

  const patchFile = path.join(__dirname, `patch-${hash}.diff`);
  if (fs.existsSync(patchFile)) {
    const originalContent = await fs.promises.readFile(patchFile, `utf8`);
    const updatedContent = originalContent.replace(/^semver exclusivity .*\n/gm, `semver exclusivity ${range}\n`);
    if (originalContent !== updatedContent) {
      console.log(`Updating range for ${path.basename(patchFile)}`);
      await fs.promises.writeFile(patchFile, updatedContent);
      return {patchFile, content: updatedContent};
    } else {
      console.log(`Skipping; patch ${path.basename(patchFile)} already exists`);
      return {patchFile, content: originalContent};
    }
  }

  await cloneRepository();

  const base = await buildRepository({onto});
  const patched = await buildRepository({from, to, onto});

  const buffer = await execFile(`git`, [`diff`, `--no-index`, base, patched], {checkExitCode: false});

  let patch = buffer.toString();
  patch = patch.replace(/^--- /gm, `semver exclusivity ${range}\n--- `);
  patch = patch.replace(new RegExp(`${base}/`, `g`), `/`);
  patch = patch.replace(new RegExp(`${patched}/`, `g`), `/`);
  patch = patch.replace(new RegExp(`${patched}/`, `g`), `/`);

  await fs.promises.writeFile(patchFile, patch);

  return {patchFile, content: patch};
}

async function validate(version, patch) {
  const tmpDir = path.join(TMP_DIR, `v${version}`);
  const tarball = path.join(tmpDir, `package.tgz`);

  await fs.promises.mkdir(tmpDir, {recursive: true});

  if (!fs.existsSync(tarball)) {
    const data = await fetch(`https://registry.yarnpkg.com/typescript/-/typescript-${version}.tgz`);
    await fs.promises.writeFile(tarball, data);
  }

  if (!fs.existsSync(path.join(tmpDir, `package`)))
    await execFile(`tar`, [`xvf`, tarball], {cwd: tmpDir});

  const patchContent = patch.content.replace(/^semver exclusivity .*\n/gm, ``);
  await fs.promises.writeFile(path.join(tmpDir, `patch.diff`), patchContent);

  await execFile(`git`, [`apply`, `--check`, `../patch.diff`], {cwd: path.join(tmpDir, `package`)});
}

async function main() {
  const patches = [];
  let isFirst = true;

  for (const slice of SLICES) {
    if (!isFirst)
      console.log();

    isFirst = false;

    console.log(`## Slice: ${JSON.stringify(slice)}`);
    console.log();

    const patch = await run(slice);
    const versions = await fetchVersions(slice.range);

    for (const version of versions) {
      console.log(`Validating ${version}...`);
      await validate(version, patch);
    }

    patches.push(patch);
  }

  const aggregatePatchFile = path.join(TMP_DIR, `patch.diff`);
  await fs.promises.writeFile(aggregatePatchFile, patches.map(patch => patch.content).join(``));

  const jsPatchFile = path.join(__dirname, `../../sources/patches/typescript.patch.ts`);
  await execFile(`node`, [path.join(__dirname, `../createPatch.js`), aggregatePatchFile, jsPatchFile]);

  // Remove old patches
  const patchFilesSet = new Set(patches.map(patch => patch.patchFile));
  for await (const {name: patchName} of await fs.promises.opendir(__dirname)) {
    if (patchName.endsWith(`.diff`) && !patchFilesSet.has(path.join(__dirname, patchName))) {
      console.log(`Cleanup; file ${patchName} not in use`);
      await fs.promises.unlink(path.join(__dirname, patchName));
    }
  }
}

main().catch(err => {
  console.error(err.stack);
  process.exitCode = 1;
});
