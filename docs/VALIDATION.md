# 验证记录

日期：2026-10-25。环境：Windows，Node.js 24.15.0，Chrome，生产构建的本地静态服务。

## 自动检查

`npm test`：**37 项通过，0 项失败**。

- RFC 6238：SHA-1 / SHA-256 / SHA-512 各 6 个官方向量，包含超过 2038 年的时间值。
- RFC 4226：计数器 0–9 的 10 个官方向量。
- 30 秒、60 秒周期边界；6/8 位及前导零。
- 随机密钥的 20/32/64 字节长度、Base32 往返和格式。
- 小写/空格规范化；无效字符、长度、填充、非零尾部位拒绝。
- Unicode otpauth 解析、URI 参数优先、HOTP counter 必填、参数冲突、重复参数及非法数值拒绝。
- 批量逐行容错、空输入和超过 50 条拒绝。
- qrcode → RGBA 像素 → jsQR → otpauth 参数完整往返。
- 源码架构回归检查：无浏览器存储 API、Cookie 写入、远程计算请求、秘密 URL 写入或 Math.random。

`npm run build`：生产构建成功。依赖安装时 npm audit 报告 0 个已知漏洞（不等于独立安全审计）。

## Chrome 实际操作

| 场景 | 观察结果 |
|---|---|
| 首次打开 | 输入为空，复制禁用，无预填真实密钥 |
| 示例密钥 | 实时显示 TOTP 与倒计时，提供公开示例说明 |
| HOTP 标准链接 | counter=0 显示 755224 |
| 手动递增与复制 | counter=1 显示并复制 287082，复制本身不递增 |
| 修改为非法输入 | 旧验证码被清空，复制被禁用，显示格式错误 |
| 随机密钥生成 | 出现新 Base32 密钥和二维码 |
| 生成后查看验证码 | 将当前配置传入取码页内存，正确显示服务和账户 |
| 批量包含错误行 | 两条有效结果正常显示，一条错误行独立提示 |
| 图片粘贴识别 | 粘贴公开 RFC HOTP 二维码，识别出 RFC / alice 和 755224 |
| 一键清空 | 输入与结果均为空，复制禁用 |
| 刷新与切换工具 | 输入和结果不恢复 |
| 手机布局 | 390×844 视口检查；导航改为四列图标文字；页面没有横向溢出 |

截图：`output/playwright/mobile.png` 和 `output/playwright/desktop.png`。仅使用公开测试种子，不包含用户密钥。

## 服务验证

首页 HTTP 200；实际响应包含 CSP（connect-src 'none'）、Referrer-Policy: no-referrer、X-Content-Type-Options: nosniff、X-Frame-Options: DENY、Cache-Control: no-store 与相机/麦克风/定位禁用策略。

## 未覆盖与限制

- 自动化文件选择受 Chrome 扩展“Allow access to file URLs”权限限制。没有修改扩展权限。图片粘贴入口和底层解码已验证；文件选择、拖放入口未完成独立端到端测试。
- 如需开放该自动化文件选择权限，工具给出的原文说明是：To enable file upload, open chrome://extensions, click Details under the ChatGPT browser extension, and enable "Allow access to file URLs." See [here](https://developers.openai.com/codex/app/chrome-extension#upload-files) for details.
- 未测试 Safari / Firefox、移动真机、Docker 构建、反向代理与公网 HTTPS 部署。
- 没有测试实际第三方平台账户，也没有独立密码学或渗透审计。
- “无存储”检查覆盖项目源码 API 使用和可观察刷新行为，不宣称能控制系统剪贴板历史、浏览器扩展或物理内存残留。
