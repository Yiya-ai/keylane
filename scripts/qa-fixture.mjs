// Public RFC fixture only; never put real user keys in test assets.
import QRCode from 'qrcode';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir = new URL('../output/playwright/',import.meta.url);
await mkdir(dir,{recursive:true});
await QRCode.toFile(fileURLToPath(new URL('rfc-hotp.png',dir)),'otpauth://hotp/RFC:alice?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&counter=0',{width:420,margin:4});
