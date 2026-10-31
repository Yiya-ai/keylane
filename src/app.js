import './style.css';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { parseInput, parseOtpUri, generateOtp, createSecret, normalizeEntry, toOtpUri, parseBatch } from './otp.js';
import { icon } from './icons.js';

const root = document.querySelector('#app');
const $ = (s) => document.querySelector(s);
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles = { verify:['验证码，即取即用。','输入 2FA 密钥，安全地获取当下的验证码。'], generate:['从一把新密钥开始。','生成随机密钥与配置二维码，用于你自己的 2FA 服务。'], scan:['扫一扫，读出验证码。','选择或粘贴二维码图片，识别过程只在当前浏览器进行。'], batch:['多个验证码，一次获取。','每行一条密钥或 otpauth 链接，最多支持 50 条。'], about:['简单，也交代清楚。','了解验证码的工作方式，以及这个工具的使用边界。'] };
const nav = [['verify','code','获取验证码'],['generate','key','生成密钥'],['scan','qr','识别二维码'],['batch','layers','批量取码']];
let page = 'verify', active = null, generated = null, batch = [], epoch = 0, timer, toastTimer, lastStep = '', dark = false, running = false;

function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800); }
function error(message = '') { const el = $('#error'); if (el) {el.textContent = message; el.hidden = !message;} }
function discard() { epoch++; active = null; generated = null; batch = []; lastStep = ''; clearTimeout(timer); }
function shell() {
  const title = titles[page];
  root.innerHTML = `<div class="layout">
    <aside class="sidebar">
      <a class="brand" href="#" data-action="nav" data-page="verify" aria-label="Keylane 首页"><img src="/icon.svg" width="36" height="36" alt=""/><span>Keylane<small>即用即走的 2FA 工具</small></span></a>
      <div class="nav-label">工作台</div>
      <nav aria-label="工具导航">${nav.map(([id,i,label]) => `<button class="nav-item ${page === id ? 'active' : ''}" data-action="nav" data-page="${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${page === id ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="privacy-note">${icon('shield')}<strong>密钥，只在你这里。</strong><p>不上传，不留历史。<br/>用完清空，轻装离开。</p></div><button class="nav-item ${page === 'about' ? 'active' : ''}" data-action="nav" data-page="about">${icon('info')}使用说明</button><div class="version">Keylane <span>v1.0</span></div></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">工具箱 <span>/</span> <b>${nav.find(n=>n[0]===page)?.[2] || '使用说明'}</b></div><div class="top-actions"><span class="local-badge"><i></i>浏览器本地计算</span><button class="icon-button" data-action="theme" aria-label="切换${dark ? '浅色' : '深色'}主题">${icon(dark ? 'sun' : 'moon')}</button></div></header>
      <main id="main"><div class="page-heading"><div><h1>${title[0]}</h1><p>${title[1]}</p></div>${page !== 'about' ? `<button class="quiet-button clear-all" data-action="clear">${icon('clear')}清空当前内容</button>` : ''}</div>
      <div class="session-note">${icon('lock')}<span>无需登录 · 不保存输入 · 刷新、关闭或切换工具后清空</span></div>
      ${page === 'verify' ? verifyView() : page === 'generate' ? generateView() : page === 'scan' ? scanView() : page === 'batch' ? batchView() : aboutView()}
      <div class="trust-row"><span>${icon('shield')}密钥不离开浏览器</span><span>${icon('bolt')}无需网络计算验证码</span><span>${icon('check')}标准 TOTP / HOTP</span></div>
      </main><footer><span>Keylane，让验证简单一点。</span><button class="text-button" data-action="nav" data-page="about">使用说明</button><span>无广告 · 无追踪 · 无账号</span></footer>
    </div></div>`;
  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) error('请通过 HTTPS 或 localhost 打开此工具，当前环境无法使用安全加密 API。');
}

function advanced(prefix = '', generator = false) {
  return `<details class="advanced" ${generator ? 'open' : ''}><summary><span>${icon('sliders')}参数设置 <small>${generator ? '与接入服务保持一致' : '默认 SHA-1 · 6 位 · 30 秒'}</small></span>${icon('chevron')}</summary><div class="fields-grid">
  <label>验证码类型<select name="type" id="${prefix}type"><option value="totp">TOTP · 按时间</option><option value="hotp">HOTP · 按计数器</option></select></label>
  <label>摘要算法<select name="algorithm"><option value="SHA1">SHA-1（常用）</option><option value="SHA256">SHA-256</option><option value="SHA512">SHA-512</option></select></label>
  <label>验证码位数<select name="digits"><option value="6">6 位</option><option value="8">8 位</option></select></label>
  <label data-period>刷新周期（秒）<input name="period" type="number" value="30" min="5" max="300" required/></label>
  <label data-counter hidden>计数器<input name="counter" type="number" value="0" min="0" max="9007199254740991" step="1" required disabled/></label>
  </div></details>`;
}
function outputCard() {
  return `<section class="output-card" aria-labelledby="output-title"><div class="output-top"><h2 id="output-title">当前验证码</h2><span id="output-type" class="type-tag">TOTP</span></div>
  <div class="code-area"><span id="account-label">等待输入密钥</span><div class="digit-display" id="code" aria-label="验证码未生成">— — —<span> </span>— — —</div><div id="countdown" class="countdown">${icon('clock')}输入后自动开始计时</div></div>
  <div class="progress"><div id="progress-bar"></div></div><button id="copy-code" class="copy-code" data-action="copy-code" disabled>${icon('copy')}复制验证码</button>
  <button id="next-counter" class="hotp-next" data-action="advance" hidden>${icon('refresh')}递增计数器</button>
  <p id="output-footnote">验证码会自动更新，请在有效期内使用。</p></section>`;
}
function verifyView() {
  return `<div class="tool-grid"><section class="input-card"><div class="section-heading"><div class="section-icon">${icon('key')}</div><div><h2>输入你的密钥</h2><p>支持 Base32 密钥或 otpauth 链接</p></div></div>
  <form id="verify-form" autocomplete="off"><label class="field-label" for="secret">2FA 密钥 / 配置链接</label><div class="secret-wrap"><input id="secret" name="secret" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" maxlength="4096" placeholder="粘贴密钥或 otpauth://…" required/><button type="button" class="icon-button reveal" data-action="reveal" aria-label="显示密钥">${icon('eye')}</button></div><div class="field-hint"><span>空格会自动忽略，密钥不区分大小写</span><button type="button" class="text-button" data-action="example">试用示例</button></div>
  ${advanced()}<p id="uri-note" class="inline-note" hidden>已使用链接内的参数，下方自定义参数不影响该链接。</p><p id="error" class="error" role="alert" hidden></p>
  <button type="submit" class="primary-button">获取验证码 ${icon('arrow')}</button></form></section>${outputCard()}</div>
  <section class="howto"><h2>从密钥到验证码，只需一步</h2><div class="howto-grid"><div><span class="step">1</span><h3>找到你的密钥</h3><p>使用目标平台提供的 2FA 设置密钥，或标准配置链接。</p></div><div><span class="step">2</span><h3>在这里获取验证码</h3><p>粘贴后自动计算。常见服务使用默认参数即可。</p></div><div><span class="step">3</span><h3>复制，完成验证</h3><p>返回目标平台输入验证码，用完可一键清空。</p></div></div></section>
  <div class="info-strip">${icon('info')}<p>验证码不正确？先确认密钥与参数，再检查设备的系统时间是否已自动同步。</p></div>`;
}
function generateView() {
  return `<div class="tool-grid generate-grid"><section class="input-card"><div class="section-heading"><div class="section-icon">${icon('key')}</div><div><h2>创建一把随机密钥</h2><p>使用浏览器的密码学安全随机数生成器</p></div></div><form id="generate-form" autocomplete="off"><div class="fields-grid"><label>服务名称<input name="issuer" placeholder="例如 My App" maxlength="60" value="My App" required/></label><label>账户标识<input name="account" placeholder="例如 alice@example.com" maxlength="100" required/></label></div><label class="full-field">密钥强度<select name="bytes"><option value="20">160 bit · 32 个字符（常用）</option><option value="32">256 bit · 52 个字符</option><option value="64">512 bit · 103 个字符</option></select></label>${advanced('gen-',true)}<p id="error" class="error" role="alert" hidden></p><button type="submit" class="primary-button">${icon('refresh')}生成新密钥</button></form></section>
  <section class="generated-card"><div class="output-top"><h2>密钥与配置二维码</h2><span class="type-tag light">仅本次页面</span></div><div id="generated-empty" class="empty-qr"><div class="qr-placeholder">${icon('qr')}</div><h3>准备好你的新密钥</h3><p>填写服务和账户，点击生成。<br/>这里将显示密钥与可扫描的二维码。</p></div><div id="generated-result" hidden><div class="qr-frame"><canvas id="qr-canvas" aria-label="2FA 配置二维码"></canvas></div><p class="qr-caption">用验证器扫描，或复制下方密钥</p><label class="field-label" for="new-secret">Base32 密钥</label><div class="result-field"><code id="new-secret"></code><button class="icon-button" data-action="copy-secret" aria-label="复制新密钥">${icon('copy')}</button></div><div class="generated-actions"><button class="secondary-button" data-action="copy-uri">${icon('copy')}复制配置链接</button><button class="secondary-button" data-action="use-generated">${icon('code')}查看验证码</button></div></div></section></div>
  <div class="info-strip">${icon('info')}<p>这里生成的密钥需要先绑定到你自己的服务端，才能用于验证。它不会自动为 GitHub、Google 等已有账户开启 2FA。页面不会保存密钥，需要时请主动复制到安全位置。</p></div>`;
}
function scanView() {
  return `<div class="tool-grid"><section class="input-card"><div class="section-heading"><div class="section-icon">${icon('qr')}</div><div><h2>识别 2FA 二维码</h2><p>图片只在本机解码，不上传到服务器</p></div></div><label class="dropzone" id="dropzone" tabindex="0">${icon('upload')}<strong>选择图片，或拖放到这里</strong><span>也可以直接 Ctrl / ⌘ + V 粘贴图片</span><small>PNG / JPG / WebP · 最大 5 MB</small><input id="qr-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择二维码图片"/></label><p id="scan-status" class="inline-note">支持标准 otpauth 二维码；暂不支持 Google 批量迁移二维码。</p><p id="error" class="error" role="alert" hidden></p><div class="info-strip compact">${icon('info')}<p>请使用清晰、完整的单个二维码图片。不要分享包含密钥的截图。</p></div></section>${outputCard()}</div>`;
}
function batchView() {
  return `<section class="input-card batch-input"><div class="section-heading"><div class="section-icon">${icon('layers')}</div><div><h2>批量输入</h2><p>每行一条；普通密钥默认 SHA-1 / 6 位 / 30 秒</p></div></div><form id="batch-form" autocomplete="off"><label class="field-label" for="batch-input">密钥或配置链接</label><textarea id="batch-input" name="batch" rows="5" maxlength="100000" spellcheck="false" autocomplete="off" placeholder="JBSWY3DPEHPK3PXP&#10;otpauth://totp/Example:alice?secret=…" required></textarea><div class="batch-toolbar"><span>无效行会单独提示，不影响其他行。</span><button type="submit" class="primary-button">批量获取 ${icon('arrow')}</button></div><p id="error" class="error" role="alert" hidden></p></form></section><section class="batch-results" id="batch-results" aria-label="批量验证码"><div class="empty-state">${icon('layers')}<p>结果将在这里显示</p><span>支持最多 50 条，验证码会自动更新。</span></div></section>`;
}
function aboutView() {
  return `<section class="about-content"><article><h2>你的数据会去哪里？</h2><p>密钥、验证码和图片只在当前页面内存中处理。应用不使用 localStorage、sessionStorage、IndexedDB 或 Cookie 保存输入，不将密钥写入 URL，也没有验证码 API、统计脚本或外部二维码服务。切换工具、刷新、关闭页面或点击清空会丢弃当前输入。</p><p>点击复制会把内容写入系统剪贴板；剪贴板历史和浏览器扩展由设备管理，页面无法保证清除这些外部副本。应用会清空 DOM 和内存引用，但 JavaScript 无法保证立即擦除物理内存。</p></article><article><h2>如何获取有效验证码？</h2><p>使用目标平台已经绑定的密钥。默认 TOTP 每 30 秒更新，支持 SHA-1、SHA-256、SHA-512 及 6 / 8 位验证码。TOTP 依赖本机时间，请打开系统自动校时。HOTP 按计数器生成，复制不会自动递增；需要时手动递增，并保持与服务端同步。</p></article><article><h2>生成密钥后，为什么不能直接登录？</h2><p>验证器与服务端必须使用同一把密钥。这里生成的是新的随机密钥，适用于你自己的应用或允许自定义密钥的服务；第三方平台通常会自行签发密钥，需要使用它提供的那一把。配置链接和二维码包含完整密钥，与密钥本身同样敏感。</p></article><article><h2>能离线使用吗？</h2><p>页面完整加载后，获取验证码、生成密钥和解码图片均无需联网。此版本没有离线缓存或安装功能；断网后重新打开页面需要本地部署服务器仍然可用。非本机部署请使用 HTTPS，避免与不受信任的应用部署在同一来源。</p></article><article><h2>标准与开源依赖</h2><p>算法遵循 RFC 4226 / RFC 6238，配置链接采用 otpauth 格式。HMAC 使用 Web Crypto，二维码生成使用 qrcode，二维码解码使用 jsQR；所有依赖随站点打包，没有运行时 CDN 请求。</p><div class="source-links"><a href="https://datatracker.ietf.org/doc/html/rfc6238" target="_blank" rel="noreferrer">RFC 6238</a><a href="https://github.com/soldair/node-qrcode" target="_blank" rel="noreferrer">qrcode</a><a href="https://github.com/cozmo/jsQR" target="_blank" rel="noreferrer">jsQR</a></div></article></section>`;
}

function formOptions(form) { return Object.fromEntries(new FormData(form)); }
function updateMode(form) {
  const hotp = form.elements.type.value === 'hotp';
  form.querySelector('[data-period]').hidden = hotp; form.elements.period.disabled = hotp;
  form.querySelector('[data-counter]').hidden = !hotp; form.elements.counter.disabled = !hotp;
}
function resetOutput() {
  if (!$('#code')) return;
  $('#code').textContent = '— — —  — — —'; $('#code').setAttribute('aria-label','验证码未生成');
  $('#account-label').textContent = '等待输入密钥'; $('#countdown').textContent = '输入后自动开始计时'; $('#copy-code').disabled = true; $('#progress-bar').style.width = '0%'; $('#next-counter').hidden = true;
  $('#output-type').textContent = 'TOTP';$('#output-footnote').textContent = '验证码会自动更新，请在有效期内使用。';$('.output-card').classList.remove('expiring');
  if ($('#uri-note')) $('#uri-note').hidden = true;
}
function clearResults() { discard(); resetOutput(); error(); }
async function setEntry(entry, token) {
  const code = await generateOtp(entry);
  if (token !== epoch) return;
  active = entry; lastStep = '';
  $('#account-label').textContent = entry.issuer === '未命名服务' ? '当前密钥' : [entry.issuer,entry.account].filter(Boolean).join(' / ');
  $('#output-type').textContent = entry.type.toUpperCase(); $('#next-counter').hidden = entry.type !== 'hotp';
  $('#output-footnote').textContent = entry.type === 'totp' ? '验证码会自动更新，请在有效期内使用。' : '复制不会递增计数器，请与服务端保持同步。';
  showCode(code); await tick();
}
function showCode(code) { $('#code').textContent = code.slice(0,code.length/2) + ' ' + code.slice(code.length/2); $('#code').setAttribute('aria-label',`当前验证码 ${code}`); $('#copy-code').disabled = false; }
async function verify(showError = true) {
  clearResults(); const token = epoch, form = $('#verify-form'), value = $('#secret').value;
  if (!value.trim()) return;
  try {
    const e = parseInput(value,formOptions(form));
    $('#uri-note').hidden = !/^otpauth:/i.test(value.trim());
    await setEntry(e,token);
  } catch (e) {if (token === epoch && showError) error(e.message);}
}
async function tick() {
  if (running) return;
  running = true;
  const token = epoch;
  try {
    if (active && $('#code')) {
      const e = active, seconds = e.period - (Math.floor(Date.now()/1000) % e.period), step = e.type === 'totp' ? Math.floor(Date.now()/1000/e.period) : e.counter;
      $('#countdown').textContent = e.type === 'totp' ? `${seconds} 秒后更新` : `当前计数器：${e.counter}`;
      $('#progress-bar').style.width = `${e.type === 'totp' ? seconds/e.period*100 : 100}%`;
      $('.output-card').classList.toggle('expiring', e.type === 'totp' && seconds <= 5);
      if (step !== lastStep) { const code = await generateOtp(e); if (token !== epoch) return; showCode(code);lastStep = step; }
    }
    if (batch.length && page === 'batch') {
      await Promise.all(batch.map(async (item,i) => {
        if (!item.entry) return;
        const e = item.entry, step = e.type === 'totp' ? Math.floor(Date.now()/1000/e.period) : e.counter;
        if (item.step !== step) {const code = await generateOtp(e);if (token !== epoch) return; item.step = step; $(`#batch-code-${i}`).textContent = code.slice(0,code.length/2)+' '+code.slice(code.length/2);}
        if (token === epoch) $(`#batch-time-${i}`).textContent = e.type === 'totp' ? `${e.period - Math.floor(Date.now()/1000)%e.period}s` : `计数 ${e.counter}`;
      }));
    }
  } catch { if (token === epoch) {error('计算失败，请检查输入后重试。');resetOutput();} }
  finally { running = false; }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text);toast('已复制到剪贴板'); }
  catch { toast('无法访问剪贴板，请选中内容后手动复制。'); }
}
async function generate(form) {
  discard(); error(); $('#generated-result').hidden = true; $('#generated-empty').hidden = false;
  const token = epoch, values = formOptions(form);
  if (values.issuer.includes(':') || values.account.includes(':')) throw new Error('服务名称和账户标识不能包含冒号。');
  const entry = normalizeEntry({...values,secret:createSecret(Number(values.bytes))});
  const uri = toOtpUri(entry), canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas,uri,{width:240,margin:4,errorCorrectionLevel:'M',color:{dark:'#123d35',light:'#ffffff'}});
  if (token !== epoch) return;
  generated = {entry,uri};
  const target = $('#qr-canvas');target.width = canvas.width;target.height = canvas.height;target.getContext('2d').drawImage(canvas,0,0);
  $('#new-secret').textContent = entry.secret;$('#generated-empty').hidden = true;$('#generated-result').hidden = false;
  toast('已生成新密钥，仅保留在当前页面');
}
async function decodeImage(file) {
  clearResults(); const token = epoch;
  if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5*1024*1024) throw new Error('请选择 5 MB 以内的 PNG、JPG 或 WebP 图片。');
  $('#scan-status').textContent = '正在本地识别…';
  const bitmap = await createImageBitmap(file);
  try {
    if (token !== epoch) return;
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('图片分辨率过大，请裁剪二维码后重试。');
    const scale = Math.min(1,1600/Math.max(bitmap.width,bitmap.height)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale));
    const ctx = canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const pixels = ctx.getImageData(0,0,canvas.width,canvas.height), decoded = jsQR(pixels.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'});
    pixels.data.fill(0);canvas.width = 0;canvas.height = 0;
    if (!decoded) throw new Error('没有识别到二维码，请使用更清晰、完整的图片。');
    const entry = parseOtpUri(decoded.data);await setEntry(entry,token);
    if (token === epoch) $('#scan-status').textContent = '识别成功，已按二维码内的参数生成验证码。';
  } finally { bitmap.close(); }
}
async function batchGenerate(form) {
  discard();error(); const token = epoch;
  const parsed = parseBatch(formOptions(form).batch);
  batch = parsed;
  $('#batch-results').innerHTML = `<div class="batch-heading"><h2>验证码 <span>${parsed.filter(i=>i.entry).length} 条有效</span></h2><small>点击右侧按钮复制</small></div><div class="table-wrap"><table><thead><tr><th>序号 / 服务</th><th>验证码</th><th>有效期</th><th><span class="sr-only">操作</span></th></tr></thead><tbody>${parsed.map((item,i) => item.entry ? `<tr><td><span class="row-index">${i+1}</span><span>${escape(item.entry.issuer === '未命名服务' ? `密钥 ${i+1}` : item.entry.issuer)}<small>${escape(item.entry.account || item.entry.type.toUpperCase())}</small></span></td><td class="table-code" id="batch-code-${i}">计算中…</td><td id="batch-time-${i}"></td><td><button class="icon-button" data-action="copy-batch" data-index="${i}" aria-label="复制第 ${i+1} 条验证码">${icon('copy')}</button></td></tr>` : `<tr class="invalid-row"><td>第 ${i+1} 行</td><td colspan="3">${escape(item.error)}</td></tr>`).join('')}</tbody></table></div>`;
  if (token === epoch) await tick();
}

root.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  event.preventDefault(); const action = button.dataset.action;
  try {
    if (action === 'nav') {if (page !== button.dataset.page) {discard();page = button.dataset.page;shell();}return;}
    if (action === 'clear') {discard();shell();toast('当前输入与结果已清空');return;}
    if (action === 'theme') {dark = !dark;document.documentElement.dataset.theme = dark ? 'dark' : 'light';button.innerHTML = icon(dark ? 'sun' : 'moon');button.setAttribute('aria-label',`切换${dark ? '浅色' : '深色'}主题`);return;}
    if (action === 'reveal') {const visible = $('#secret').type === 'password';$('#secret').type = visible ? 'text' : 'password';button.setAttribute('aria-label',visible ? '隐藏密钥' : '显示密钥');return;}
    if (action === 'example') {$('#verify-form').reset();updateMode($('#verify-form'));$('#secret').value = 'JBSWY3DPEHPK3PXP';await verify();toast('已填入公开示例密钥，请勿用于真实账户');return;}
    if (action === 'copy-code' && active) {const token = epoch, code = await generateOtp(active);if (token === epoch) await copy(code);return;}
    if (action === 'advance' && active?.type === 'hotp') {active = normalizeEntry({...active,counter:active.counter+1});const input = $('#verify-form [name="counter"]');if (input) input.value = active.counter;lastStep = '';await tick();return;}
    if (action === 'copy-secret' && generated) return await copy(generated.entry.secret);
    if (action === 'copy-uri' && generated) return await copy(generated.uri);
    if (action === 'use-generated' && generated) {const uri = generated.uri;discard();page = 'verify';shell();$('#secret').value = uri;await verify();return;}
    if (action === 'copy-batch') {const item = batch[Number(button.dataset.index)],token=epoch;if (item?.entry) {const code = await generateOtp(item.entry);if (token===epoch) await copy(code);}return;}
  } catch(e) {error(e.message);}
});
root.addEventListener('submit', async event => {
  event.preventDefault();const form = event.target;
  try {if (form.id === 'verify-form') await verify();if (form.id === 'generate-form') await generate(form);if (form.id === 'batch-form') await batchGenerate(form);}
  catch (e) {error(e.message);}
});
root.addEventListener('input', event => {
  if (event.target.closest('#verify-form')) {clearResults();timer = setTimeout(()=>verify(true),350);}
  if (event.target.closest('#generate-form')) {discard();$('#generated-result').hidden=true;$('#generated-empty').hidden=false;$('#new-secret').textContent='';const canvas=$('#qr-canvas');canvas.width=0;canvas.height=0;error();}
  if (event.target.closest('#batch-form')) {discard();$('#batch-results').innerHTML='<div class="empty-state"><p>内容已修改，请重新获取验证码。</p></div>';error();}
});
root.addEventListener('change', async event => {
  if (event.target.name === 'type') updateMode(event.target.form);
  if (event.target.id === 'qr-file') {const file=event.target.files[0];event.target.value='';if(file) try{await decodeImage(file);}catch(e){error(e.message);if($('#scan-status')) $('#scan-status').textContent='未完成识别，请更换图片后重试。';}}
});
root.addEventListener('dragover', event=>{if(event.target.closest('#dropzone')){event.preventDefault();$('#dropzone').classList.add('dragging');}});
root.addEventListener('dragleave',event=>{if(event.target.closest('#dropzone'))$('#dropzone').classList.remove('dragging');});
root.addEventListener('drop',async event=>{if(!event.target.closest('#dropzone'))return;event.preventDefault();$('#dropzone').classList.remove('dragging');try{await decodeImage(event.dataTransfer.files[0]);}catch(e){error(e.message);}});
root.addEventListener('keydown',event=>{if(event.target.id==='dropzone' && ['Enter',' '].includes(event.key)){event.preventDefault();$('#qr-file').click();}});
document.addEventListener('paste',async event=>{if(page!=='scan')return;const file=[...event.clipboardData.items].find(i=>i.type.startsWith('image/'))?.getAsFile();if(file){event.preventDefault();try{await decodeImage(file);}catch(e){error(e.message);}}});
window.addEventListener('pagehide',()=>{discard();root.replaceChildren();});
window.addEventListener('pageshow',()=>{discard();page='verify';shell();});
setInterval(tick,250);
shell();
