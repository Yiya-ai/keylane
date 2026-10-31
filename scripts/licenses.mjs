import { readFile,writeFile } from 'node:fs/promises';
const licenses=[['jsQR','jsqr/LICENSE'],['qrcode','qrcode/license'],['dijkstrajs','dijkstrajs/LICENSE.md']];
let text='Keylane — bundled third-party notices\n\n';
for(const [name,path] of licenses)text+=`${name}\n${'='.repeat(60)}\n${await readFile(new URL('../node_modules/'+path,import.meta.url),'utf8')}\n\n`;
await writeFile(new URL('../public/third-party-licenses.txt',import.meta.url),text.trimEnd()+'\n');
