# Keylane · 即用即走的 2FA 工具

中文、纯浏览器计算的 2FA Web 工具。**不保存密钥、账户或历史记录。**

功能：实时 TOTP / HOTP、密钥和 otpauth 链接输入、160/256/512 bit 随机密钥生成、配置二维码、二维码图片/拖放/粘贴识别、最多 50 条批量取码、一键复制和清空、手机适配、临时深色主题。

## 本地运行

需要 Node.js 22.12+ 或 24+。

```powershell
cd keylane
npm ci
npm test
npm run build
npm run preview
```

打开 <http://127.0.0.1:5178>。已有依赖和构建产物时，只需 `npm run preview`。Windows 也可双击 `start.cmd`。

开发调试用 `npm run dev`，与预览服务器默认使用同一端口，请先关闭另一进程。

## 使用方式

1. **获取验证码**：粘贴目标平台已经绑定的 Base32 密钥或 `otpauth://` 链接，输入后自动计算；必要时展开参数设置。
2. **生成密钥**：填写服务/账户，选择参数，生成新的随机密钥、配置链接及二维码。服务端必须绑定同一密钥，才能验证相应的验证码。
3. **识别二维码**：选择、拖入或粘贴 PNG/JPEG/WebP 图片（最大 5 MB）。图片不上传。
4. **批量取码**：每行一条密钥或标准配置链接，最多 50 行。错误行单独提示。

切换工具、刷新、关闭页面或点击清空会丢弃输入；“查看验证码”按钮会有意将刚生成的密钥传到取码页内存。复制会写入系统剪贴板，页面不会清除系统剪贴板历史。请自行妥善保管需要使用的新密钥。

## 自行部署

`npm run build` 生成 `dist/`。可以用静态服务器部署到独立站点根路径；无需数据库、环境密钥或验证码 API。除 localhost 外请使用 HTTPS。

附带 `Dockerfile`、`compose.yaml` 和 Nginx 配置，可执行：

```sh
docker compose up --build -d
```

默认只绑定 `127.0.0.1:8080`。对外访问时在前面配置 HTTPS 反向代理。Docker 配置已提供，但本次未执行容器构建；已验证的是 Node 本地静态服务。

部署时保留严格 CSP、`no-referrer`、`nosniff`、禁止嵌入和 `Cache-Control: no-store` 响应头；不要向站点注入统计代码或第三方脚本。附带 Node / Nginx 配置已设置这些响应头。

## 文档与验证

- [竞品调研](docs/RESEARCH.md)：2fa.run 访问受阻，明确记录；补充 2fa.live，并对比 Aegis、Ente Auth、2FAuth。
- [产品与实现设计](docs/DESIGN.md)：用户最终范围、信息架构、算法、数据流及边界。
- [测试记录](docs/VALIDATION.md)：单元测试及浏览器验证结果。
- `npm test`：RFC 6238 / RFC 4226 向量、时间边界、URI 校验、随机密钥、批量容错、二维码编码/解码闭环。

本项目使用原生 JavaScript + Web Crypto，Vite 构建，qrcode 与 jsQR 随站点打包。依赖版本锁定于 package-lock.json。没有复制竞品实现；竞品许可在调研文档注明。

本项目是可运行的首版工具，未经过独立安全审计。支持当前 Chrome / Edge 等现代浏览器；Safari / Firefox 需要另行兼容性验证。

## 发布与许可

发布前执行 `npm test` 和 `npm run build`，检查暂存文件不包含真实密钥、账户信息、二维码截图、环境变量文件或本机路径。`node_modules/`、`dist/`、`output/` 和本地运行数据不进入仓库。测试中的固定密钥为公开 RFC 向量或示例，不对应真实账户。

项目尚未选择源码许可证；公开仓库不等于授予使用、修改或再分发许可。第三方依赖保留各自许可证，见 `public/third-party-licenses.txt`。
