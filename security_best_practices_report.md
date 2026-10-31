# Keylane 安全与数据保存审查

审查日期：2026-10-25。对象：恢复后的当前版本，原生 JavaScript / Web Crypto 前端、Node HTTP 静态服务、附带 Nginx 配置，以及实际运行的 `http://127.0.0.1:5178/`。

## 结论

**未发现应用主动持久化或上传用户输入的密钥、验证码、账户标识或二维码图片。未发现可确认的严重、高危漏洞；发现一项低风险资源消耗问题。**

“不保存”应理解为“不进行应用层持久化”。输入在使用期间仍存在页面 DOM 和内存中；主动复制会写入系统剪贴板。这不是零痕迹、物理内存擦除或对浏览器扩展的隔离承诺。

本次只检查并生成报告，没有修改应用功能、界面或安全配置。未使用真实账户密钥。

## 数据究竟去哪里

| 数据位置 | 审查结果与证据 |
|---|---|
| localStorage / sessionStorage / IndexedDB / Cache Storage | 源码和当前生产 JS 的相关调用扫描均无命中；未发现存储实现。当前浏览器已有存储内容未直接枚举，因此不宣称整个来源的存储绝对为空。 |
| Cookie | 未发现 Cookie 写入；实际首页响应未设置 Set-Cookie。 |
| 服务器 / 数据库 | 没有取码或保存 API，没有数据库连接。Node 服务只读取 dist 静态文件：`scripts/serve.mjs:1–18`。 |
| 网络 | 应用源码没有 fetch、XHR、WebSocket、Beacon 等计算或上传调用。实际 CSP 包含 `connect-src 'none'`。未进行全量网络抓包，不以此声称浏览器及扩展完全无网络活动。 |
| URL / 浏览历史 | 输入不会写入页面 URL 或 History API。生成的 otpauth URI 仅用于内存、二维码或用户点击复制，不导航到该 URI：`src/otp.js:53–56`、`src/app.js:136–148`、`src/app.js:186–188`。 |
| 日志 | 前端没有记录输入的 console 调用；Node 服务只打印启动地址：`scripts/serve.mjs:18`。Nginx 关闭 access_log，但没有关闭其错误日志；错误日志可能记录静态资源请求，并非应用上传的密钥。 |
| 页面内存与 DOM | **会临时持有**密钥和结果：`src/app.js:12`。clear / 工具切换通过 discard 与重建 DOM 清空；pagehide 清理引用和页面：`src/app.js:16`、`178–179`、`211–212`。 |
| 系统剪贴板 | **用户点击复制时会写入**验证码、密钥或配置链接：`src/app.js:132–134`、`184–189`。页面清空不会清除剪贴板或其历史。 |
| 项目目录 | 有源码、构建包、回退备份、测试截图和文档；它们是开发产物。未发现运行中的 Web 应用把实际用户输入写入这些文件的路径。构建脚本写入的是依赖许可文本：`scripts/licenses.mjs:5`。 |

生产 JS 内发现 1 处 fetch，位于 Vite 的 modulepreload 兼容逻辑，目标为静态 link 的 href；不是密钥计算或上传逻辑。当前入口没有 modulepreload 链接。没有把“出现 fetch 字样”直接认定为外泄。

## 发现的问题

### SEC-01：二维码图片尺寸限制发生在解码之后

- **严重程度：Low（低）**；类型：客户端资源消耗；代码顺序证据明确，实际影响程度未用破坏性大图验证。
- **位置**：`src/app.js:150–161`，`decodeImage()`。
- **证据**：先执行 `await createImageBitmap(file)`，之后才判断 `bitmap.width * bitmap.height > 40_000_000`；最长边 1600px 的缩放也发生在解码之后。
- **影响**：用户导入高度压缩、像素尺寸很大的 PNG/JPEG/WebP 时，即使文件小于 5 MB，浏览器仍可能在拒绝图片前分配大量内存。同步 jsQR 解码也可能造成短暂卡顿。
- **已有缓解**：5 MB 文件体积限制、格式白名单、40 MP 后置检查、1600px 解码画布、bitmap.close 和像素数组清零。
- **建议**：使用可靠的图片元数据解析，在完整解码前限制尺寸；将二维码识别移入 Worker 并设置超时。Worker 可以降低主线程阻塞，但单独使用不能保证限制浏览器图片解码内存。
- **适用范围**：需要用户选择、拖放或粘贴图片，不是远程自动执行，也没有证据表明可直接读取或上传密钥。

## 数据边界与加固建议（不等同于已确认漏洞）

### SEC-02：复制操作会产生页面之外的副本

**级别：Informational。** `src/app.js:133` 调用 `navigator.clipboard.writeText(text)`，这是现有复制功能的预期行为。若系统启用了剪贴板历史、同步或第三方剪贴板工具，副本可能在页面关闭后仍存在。当前使用说明已披露此边界（`src/app.js:73`）。不应把“清空页面”描述成“清除设备上的全部副本”。[Clipboard.writeText 官方说明](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)。

### SEC-03：关闭页面的清理不是可保证执行的安全擦除

**级别：Informational。** `src/app.js:211–212` 使用 pagehide/pageshow 清理；没有离开浏览器标签或空闲超时清理。正常刷新已实测清空，但页面停留、后台挂起期间仍持有数据，JavaScript 字符串也不能保证立即擦除物理内存。移动端被系统终止等情况下 pagehide 可能不触发；这不能反过来证明应用写入了磁盘。[pagehide 生命周期说明](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event)。

可按需求增加空闲清空或后台隐藏后清空，但需考虑用户切回目标平台输入验证码的流程。浏览器会话恢复、密码管理器、扩展、系统交换文件与崩溃转储未做取证检查，本项目不能提供零残留保证。

### SEC-04：迁移静态托管时必须带上响应头配置

**级别：Informational / 部署条件。** 当前运行服务与附带 Nginx 配置具备 `frame-ancestors 'none'`、`connect-src 'none'`、`Cache-Control: no-store` 等保护。`index.html:7` 中的 meta CSP 则允许 `connect-src 'self'`，也不能代替 HTTP 层的防嵌入及缓存响应头。

因此只复制 dist 到另一个静态托管平台，不保证继承当前配置。应同步配置响应头，并在非本机部署使用 HTTPS。此项不是当前 localhost 部署中已确认的漏洞。[frame-ancestors 不支持 meta 标签](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)。

`style-src 'unsafe-inline'` 仅放宽样式，并不等于放开内联 JavaScript；当前 `script-src 'self'` 没有 unsafe-inline 或 unsafe-eval，不将两者混淆报告为脚本执行漏洞。

## 已完成的验证

1. **37 项测试通过**：含 RFC 4226 / RFC 6238 官方向量、算法与长度、URI 参数校验、随机密钥、批量容错、QR 编解码往返、源码无持久化调用检查。
2. **npm 官方漏洞查询成功**：`npm audit --json` 返回 `vulnerabilities: {}`，总已知漏洞数 0，覆盖锁定的生产/开发依赖。仅代表查询时数据库已收录的问题，不等于不存在未知缺陷。
3. **实际 HTTP 响应**：首页 200，响应包含 CSP、no-store、no-referrer、nosniff、DENY、相机/麦克风/定位禁用策略。POST 返回 405；普通/编码路径穿越请求返回 404/403；`.env` 请求和畸形编码路径返回 404。没有读取或暴露工作区配置。
4. **HTML 注入显示检查**：向批量输入提供带 `<b id="audit-probe">audit</b>` 账户名的标准 URI（公开测试种子）。结果中它是纯文本，DOM 未出现 audit-probe 元素。对应 `escape()` 为 `src/app.js:9`，批量渲染为 `src/app.js:171`。单条名称与错误消息使用 textContent，未发现未转义的用户输入进入 HTML 的路径。
5. **正常清理流程**：批量输入后点击清空，输入与结果归零；另行填入公开示例后直接刷新，密钥为空、复制禁用、验证码不存在。测试结束后页面保留空白初始状态。
6. **密码学调用审查**：随机密钥采用 `crypto.getRandomValues`，默认 160 bit，支持 256/512 bit；HMAC 使用 Web Crypto，导入的 CryptoKey 不可导出。见 `src/otp.js:59–70`、`80–83`。没有使用 Math.random 生成密钥。Base32 与数值参数有边界和白名单校验。

## 限制

本报告是代码、依赖、部署响应与选定浏览器行为的审查，不是独立渗透测试或密码学审计。未穷举浏览器漏洞、扩展行为、操作系统磁盘残留，也未对 Docker 镜像、实际公网托管、TLS 代理或所有依赖源码逐行审计。源码正则测试是回归提示，不是完整污点分析；没有发现危险调用不能证明绝对不存在任何信息泄漏渠道。
