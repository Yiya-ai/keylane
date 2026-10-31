import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOtp, encodeBase32, decodeBase32, normalizeSecret, normalizeEntry, parseOtpUri, toOtpUri, createSecret, parseInput, parseBatch } from '../src/otp.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
const secret = encodeBase32(new TextEncoder().encode('12345678901234567890'));
const times = [59,1111111109,1111111111,1234567890,2000000000,20000000000];
const vectors = {
  SHA1:['94287082','07081804','14050471','89005924','69279037','65353130'],
  SHA256:['46119246','68084774','67062674','91819424','90698825','77737706'],
  SHA512:['90693936','25091201','99943326','93441116','38618901','47863826']
};
for (const [algorithm,expected] of Object.entries(vectors)) {
  const length = {SHA1:20,SHA256:32,SHA512:64}[algorithm];
  const key = encodeBase32(new TextEncoder().encode('1234567890'.repeat(7).slice(0,length)));
  for (let i=0;i<times.length;i++) test(`RFC 6238 ${algorithm} t=${times[i]}`,async()=>assert.equal(await generateOtp({secret:key,algorithm,digits:8},times[i]*1000),expected[i]));
}
const hotp = ['755224','287082','359152','969429','338314','254676','287922','162583','399871','520489'];
for(let counter=0;counter<hotp.length;counter++)test(`RFC 4226 counter=${counter}`,async()=>assert.equal(await generateOtp({secret,type:'hotp',counter}),hotp[counter]));
test('TOTP respects boundaries and custom periods',async()=>{
  assert.equal(await generateOtp({secret,period:60},59999),hotp[0]);
  assert.equal(await generateOtp({secret,period:60},60000),hotp[1]);
  assert.equal(await generateOtp({secret},29999),hotp[0]);
  assert.equal(await generateOtp({secret},30000),hotp[1]);
});
test('Base32 random key roundtrips for supported lengths',()=>{
  for(const size of [20,32,64]){const a=createSecret(size),b=createSecret(size);assert.notEqual(a,b);assert.equal(decodeBase32(a).length,size);assert.equal(encodeBase32(decodeBase32(a)),a);assert.match(a,/^[A-Z2-7]+$/);}
  assert.throws(()=>createSecret(10));
});
test('Base32 accepts lowercase and spaces; rejects bad padding/trailing bits',()=>{
  assert.equal(normalizeSecret('jbsw y3dp ehpk 3pxp'),'JBSWY3DPEHPK3PXP');
  const encoded=encodeBase32(new Uint8Array(32));assert.equal(normalizeSecret(encoded+'===='),encoded);
  for(const value of ['','abc','JBSWY3DPEHPK3PX0','A'.repeat(17),'A'.repeat(51)+'B','A'.repeat(16)+'====','A'.repeat(16)+'!'])assert.throws(()=>normalizeSecret(value));
});
test('otpauth parses encoded unicode and overrides manual options',()=>{
  const uri='otpauth://totp/%E6%B5%8B%E8%AF%95%3A%20alice%40example.com?secret='+secret+'&issuer=%E6%B5%8B%E8%AF%95&algorithm=SHA256&digits=8&period=60';
  const e=parseInput(uri,{algorithm:'SHA1',digits:6,period:30});assert.equal(e.issuer,'测试');assert.equal(e.account,'alice@example.com');assert.equal(e.algorithm,'SHA256');assert.equal(e.digits,8);assert.equal(e.period,60);
  assert.deepEqual(parseOtpUri(toOtpUri(e)),e);
});
test('HOTP URI requires counter and roundtrips',()=>{
  const e=normalizeEntry({issuer:'Example',account:'alice',secret,type:'hotp',counter:123});assert.deepEqual(parseOtpUri(toOtpUri(e)),e);
  assert.throws(()=>parseOtpUri('otpauth://hotp/Example?secret='+secret));
});
test('malformed or unsupported configurations are rejected',()=>{
  for(const suffix of ['&digits=7','&period=0','&period=5.5','&period=0x1e','&counter=','&counter=1e3','&algorithm=MD5','&secret='+secret,'&issuer=Other','&counter=-1'])assert.throws(()=>parseOtpUri('otpauth://totp/Example:alice?secret='+secret+suffix));
  for(const uri of ['https://example.com','otpauth-migration://offline?data=abc','otpauth://steam/x?secret='+secret,'otpauth://totp/%ZZ?secret='+secret])assert.throws(()=>parseOtpUri(uri));
  assert.throws(()=>normalizeEntry({secret,counter:Number.MAX_SAFE_INTEGER+1}));
});
test('batch keeps valid rows and reports individual errors',()=>{
  const result=parseBatch(secret+'\ninvalid\n\notpauth://totp/Work:alice?secret='+secret);assert.equal(result.length,3);assert.ok(result[0].entry);assert.ok(result[1].error);assert.equal(result[2].entry.issuer,'Work');
  assert.throws(()=>parseBatch(''));assert.throws(()=>parseBatch((secret+'\n').repeat(51)));
});
test('generated QR is readable by jsQR and preserves all OTP parameters',()=>{
  const uri=toOtpUri({issuer:'测试应用',account:'alice@example.com',secret:createSecret(32),algorithm:'SHA256',digits:8,period:60});
  const qr=QRCode.create(uri,{errorCorrectionLevel:'M'}),scale=6,margin=4,size=(qr.modules.size+margin*2)*scale,pixels=new Uint8ClampedArray(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const mx=Math.floor(x/scale)-margin,my=Math.floor(y/scale)-margin;const dark=mx>=0&&my>=0&&mx<qr.modules.size&&my<qr.modules.size&&qr.modules.get(my,mx);const index=(y*size+x)*4;pixels[index]=pixels[index+1]=pixels[index+2]=dark?0:255;pixels[index+3]=255;}
  const result=jsQR(pixels,size,size);assert.ok(result);assert.equal(result.data,uri);assert.deepEqual(parseOtpUri(result.data),parseOtpUri(uri));
});
