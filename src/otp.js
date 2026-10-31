const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function normalizeSecret(value) {
  const input = String(value ?? '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z2-7]+={0,6}$/.test(input)) throw new Error('密钥须为 Base32 格式，只能包含 A–Z 和 2–7。');
  const raw = input.replace(/=+$/, '');
  if (raw.length < 16 || raw.length > 1024 || ![0, 2, 4, 5, 7].includes(raw.length % 8)) throw new Error('密钥长度无效，至少需要 16 个 Base32 字符。');
  if (input.includes('=') && (input.length % 8 !== 0 || input.length - raw.length !== (8 - raw.length % 8) % 8)) throw new Error('密钥的 Base32 填充无效。');
  let bits = 0, acc = 0;
  for (const c of raw) { acc = (acc << 5) | alphabet.indexOf(c); bits += 5; if (bits >= 8) { bits -= 8; acc &= (1 << bits) - 1; } }
  if (bits && acc !== 0) throw new Error('密钥的 Base32 尾部位无效。');
  return raw;
}

export function decodeBase32(value) {
  const secret = normalizeSecret(value), bytes = [];
  let bits = 0, acc = 0;
  for (const c of secret) { acc = (acc << 5) | alphabet.indexOf(c); bits += 5; if (bits >= 8) { bits -= 8; bytes.push((acc >>> bits) & 255); acc &= (1 << bits) - 1; } }
  return new Uint8Array(bytes);
}

export function normalizeEntry(input) {
  if (!input || typeof input !== 'object') throw new Error('账户格式无效。');
  const type = String(input.type ?? 'totp').toLowerCase();
  const algorithm = String(input.algorithm ?? 'SHA1').toUpperCase().replaceAll('-', '');
  const digits = Number(input.digits ?? 6), period = Number(input.period ?? 30), counter = Number(input.counter ?? 0);
  if (!['totp', 'hotp'].includes(type)) throw new Error('暂仅支持 TOTP 和 HOTP，不能导入 Steam 或迁移二维码。');
  if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) throw new Error('不支持的摘要算法。');
  if (![6, 8].includes(digits)) throw new Error('验证码位数必须为 6 或 8。');
  if (!Number.isInteger(period) || period < 5 || period > 300) throw new Error('刷新周期必须是 5–300 秒的整数。');
  if (!Number.isSafeInteger(counter) || counter < 0) throw new Error('HOTP 计数器必须为非负安全整数。');
  const text = (x, max) => String(x ?? '').trim().slice(0, max);
  const issuer = text(input.issuer, 100) || '未命名服务', account = text(input.account, 200);
  return { issuer, account, secret: normalizeSecret(input.secret), type, algorithm, digits, period, counter };
}

export function parseOtpUri(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('请输入有效的 otpauth:// 链接。'); }
  if (url.protocol !== 'otpauth:' || !['totp', 'hotp'].includes(url.hostname) || url.username || url.password || url.port || url.hash) throw new Error('仅支持标准 otpauth://totp 或 otpauth://hotp 链接。');
  for (const key of ['secret','issuer','algorithm','digits','period','counter']) if (url.searchParams.getAll(key).length > 1) throw new Error('链接含有重复参数，请检查来源。');
  for (const key of ['digits','period','counter']) if (url.searchParams.has(key) && !/^(0|[1-9]\d*)$/.test(url.searchParams.get(key))) throw new Error('链接中的数值参数必须为十进制非负整数。');
  let label;
  try { label = decodeURIComponent(url.pathname.slice(1)); } catch { throw new Error('账户名称编码无效。'); }
  const colon = label.indexOf(':'), prefix = colon >= 0 ? label.slice(0, colon).trim() : '';
  const issuer = url.searchParams.get('issuer')?.trim() || prefix;
  if (prefix && issuer && prefix !== issuer) throw new Error('链接中的服务名称不一致，请检查 issuer。');
  if (url.hostname === 'hotp' && !url.searchParams.has('counter')) throw new Error('HOTP 链接缺少 counter。');
  const input = { type:url.hostname, issuer, account:colon >= 0 ? label.slice(colon + 1).trim() : label };
  for (const key of ['secret','algorithm','digits','period','counter']) if (url.searchParams.has(key)) input[key] = url.searchParams.get(key);
  return normalizeEntry(input);
}

export function toOtpUri(entry) {
  const e = normalizeEntry(entry);
  const params = new URLSearchParams({ secret:e.secret, issuer:e.issuer, algorithm:e.algorithm, digits:String(e.digits), [e.type === 'hotp' ? 'counter' : 'period']:String(e.type === 'hotp' ? e.counter : e.period) });
  return `otpauth://${e.type}/${encodeURIComponent(e.issuer)}:${encodeURIComponent(e.account)}?${params}`;
}

export async function generateOtp(entry, time = Date.now()) {
  const e = normalizeEntry(entry);
  const counter = e.type === 'hotp' ? e.counter : Math.floor(time / 1000 / e.period);
  if (!Number.isSafeInteger(counter) || counter < 0) throw new Error('时间或计数器无效。');
  const message = new Uint8Array(8);
  new DataView(message.buffer).setBigUint64(0, BigInt(counter));
  const key = await crypto.subtle.importKey('raw', decodeBase32(e.secret), {name:'HMAC', hash:e.algorithm.replace('SHA', 'SHA-')}, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = digest[digest.length - 1] & 15;
  const binary = new DataView(digest.buffer).getUint32(offset) & 0x7fffffff;
  return String(binary % 10 ** e.digits).padStart(e.digits, '0');
}

export function encodeBase32(bytes) {
  let acc = 0, bits = 0, out = '';
  for (const byte of bytes) { acc = (acc << 8) | byte; bits += 8; while (bits >= 5) {bits -= 5; out += alphabet[(acc >>> bits) & 31];} acc &= (1 << bits) - 1; }
  if (bits) out += alphabet[(acc << (5 - bits)) & 31];
  return out;
}

export function createSecret(byteLength = 20) {
  if (![20,32,64].includes(byteLength)) throw new Error('密钥长度须为 160、256 或 512 bit。');
  return encodeBase32(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function parseInput(value, options = {}) {
  const input = value.trim();
  if (/^otpauth:/i.test(input)) return parseOtpUri(input);
  return normalizeEntry({...options, secret:input});
}

export function parseBatch(text, options = {}) {
  if (text.length > 100000) throw new Error('批量内容最多 100 KB。');
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 50) throw new Error('每次请输入 1–50 条密钥或 otpauth 链接。');
  return lines.map((line,index) => {
    try { return { entry:parseInput(line,options),index }; }
    catch (error) { return {error:error.message,index}; }
  });
}
