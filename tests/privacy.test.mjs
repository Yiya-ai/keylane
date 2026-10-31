import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
test('application has no persistence, remote computation or secret URL plumbing',async()=>{
  const dir=new URL('../src/',import.meta.url);
  const files=(await readdir(dir)).filter(f=>f.endsWith('.js'));
  for(const file of files){
    const source=await readFile(new URL(file,dir),'utf8');
    assert.doesNotMatch(source,/\b(?:localStorage|sessionStorage|indexedDB|caches)\s*[.\[(]/,file);
    assert.doesNotMatch(source,/document\s*\.\s*cookie\s*=/,file);
    assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/,file);
    assert.doesNotMatch(source,/history\s*\.\s*(?:pushState|replaceState)\s*\(/,file);
    assert.doesNotMatch(source,/location\s*\.\s*(?:hash|search|href)\s*=/,file);
    assert.doesNotMatch(source,/\bMath\s*\.\s*random\s*\(/,file);
  }
});
