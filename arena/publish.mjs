// publish.mjs: put the repository on GitHub as the organisation's bot (the GitHub App ai-wudaohui-bot, owned by ai-native-workshop), so
// nothing public (commits, the activity page, events) names a person. The app's private key stays on this machine; each run mints a token
// that lasts an hour and hands it to git in a header, never to a config file or the keychain.
//
//   node arena/publish.mjs      push main; the first time it also creates the repository and turns on GitHub Pages
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_ID = 5462439, ORG = 'ai-native-workshop', REPO = 'wudaohui', KEY = process.env.WUDAOHUI_APP_KEY || join(homedir(), '.ssh/ai-wudaohui-bot.pem');
const HOME = `https://${ORG}.github.io/${REPO}/`;                         // GitHub Pages; renaming the organisation moves it and the old address 404s
const DESCRIPTION = '6 家大模型各写一个格斗程序，在同一个 2D 擂台上对打 15000 局：擂台引擎、参赛程序原样、规则书、逐局结果和网页可玩版';

const b64u = s => Buffer.from(s).toString('base64url');
function appJwt() {                                                         // the app proves itself with a short JWT signed by its key
  const now = Math.floor(Date.now() / 1000), head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), body = b64u(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(APP_ID) }));
  return `${head}.${body}.${createSign('RSA-SHA256').update(`${head}.${body}`).sign(readFileSync(KEY), 'base64url')}`;
}
async function gh(path, token, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, { method, body: body && JSON.stringify(body),
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) } });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const fail = (what, r) => { throw new Error(`${what}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); };

const app = appJwt(), insts = await gh('/app/installations', app);
const inst = Array.isArray(insts.data) && insts.data.find(i => i.account?.login === ORG);
if (!inst) fail(`the app is not installed on ${ORG}`, insts);
const tok = await gh(`/app/installations/${inst.id}/access_tokens`, app, { method: 'POST' });
if (tok.status !== 201) fail('installation token', tok);
const token = tok.data.token;

let repo = await gh(`/repos/${ORG}/${REPO}`, token);
if (repo.status === 404) {
  repo = await gh(`/orgs/${ORG}/repos`, token, { method: 'POST', body: { name: REPO, description: DESCRIPTION, homepage: HOME, private: false, has_wiki: false, has_projects: false } });
  if (repo.status !== 201) fail('create the repository', repo);
  console.log(`created ${ORG}/${REPO}`);
} else if (repo.data?.homepage !== HOME) {                                  // the link in the repository's About box doesn't follow a rename
  const r = await gh(`/repos/${ORG}/${REPO}`, token, { method: 'PATCH', body: { homepage: HOME } });
  if (r.status !== 200) fail('update the homepage link', r);
  console.log(`homepage: ${HOME}`);
}
const header = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
execFileSync('git', ['-c', `http.extraheader=${header}`, '-c', 'credential.helper=', 'push', `https://github.com/${ORG}/${REPO}.git`, 'main'], { cwd: root, stdio: 'inherit' });
const pages = await gh(`/repos/${ORG}/${REPO}/pages`, token);
if (pages.status === 404) {
  const r = await gh(`/repos/${ORG}/${REPO}/pages`, token, { method: 'POST', body: { source: { branch: 'main', path: '/' } } });
  if (r.status !== 201) fail('turn on Pages', r);
  console.log(`pages on: ${r.data.html_url} (the first build takes a minute or two)`);
} else console.log(`pages: ${pages.data?.html_url} ${pages.data?.status || ''}`);
