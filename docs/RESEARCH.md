# Competitive Research Snapshot

调研日期：2026-10-25。依据用户最终要求：**不保存账户或密钥，只做取码、生成密钥等即时工具**。

## 1. Scope

**Company/product:** Keylane | **Category:** 临时 2FA Web 工具 | **Decision supported:** 首版范围与交互 | **Competitors analyzed:** 2fa.run（访问受阻）、2fa.live、Aegis、Ente Auth、2FAuth。

证据口径：**Fact** 表示本次读取的页面或官方文档明确陈述，不等于独立安全审计；**Inference** 表示据此作出的产品判断；**Assumption** 表示待用户使用验证的假设。主要来源来自官方产品网站和代码仓库，属于一个公开资料渠道；没有把它包装为多渠道独立验证。

## 2. Competitor Snapshots

### Competitor: 2fa.run
- **Positioning:** 用户指定参考对象；本次无法直接确认其当前定位和界面。
- **Relevant capability:** 未核实。网页抓取返回 403；Chrome 访问返回 ERR_CONNECTION_CLOSED。
- **Likely strength:** 证据不足，不作断言。
- **Likely weakness:** 不能把本环境访问失败当成产品本身不可用或安全性有问题。
- **Key source URL:** [2fa.run](https://2fa.run/)。证据缺口：功能、开源仓库、数据处理方式均待直接访问验证。

### Competitor: 2fa.live（补充同类工具）
- **Positioning:** Fact，高信心：网页提供 2FA Secret 输入、Submit 和 Code / Copy 输出。[页面](https://2fa.live/)
- **Relevant capability:** Fact，高信心：核心页面直接面向输入密钥、获取并复制验证码；页面含多处广告。
- **Likely strength:** Inference，中信心：单一任务路径短，适合临时取码。
- **Likely weakness:** Inference，中信心：广告增加操作干扰；未审计其脚本与网络行为，不能据此判断它是否上传或存储密钥。
- **Key source URL:** [2fa.live](https://2fa.live/)

### Competitor: Aegis Authenticator
- **Positioning:** Fact，高信心：面向 Android 的开源验证器。[README](https://github.com/beemdevelopment/Aegis)
- **Relevant capability:** Fact，高信心：TOTP/HOTP、二维码/手动/其他应用导入、分组搜索、AES-256-GCM 保险库、scrypt 密码解锁、生物识别、明文或加密导出与自动备份。
- **Likely strength:** Inference，中信心：适合长期管理大量账户，恢复与迁移路径较完整。
- **Likely weakness:** Inference，中信心：需要管理保险库与移动应用，不符合本项目“临时使用、不存储”的最终范围。
- **Key source URL:** [官方 README](https://raw.githubusercontent.com/beemdevelopment/Aegis/master/README.md)，GPL-3.0；本项目仅参考能力设计，未复制其实现。

### Competitor: Ente Auth
- **Positioning:** Fact，高信心：开源验证器，官网强调端到端加密备份与跨平台同步。[官网](https://ente.com/auth/)
- **Relevant capability:** Fact，高信心：移动/桌面/Web、下一个验证码、标签、置顶、搜索、备注、无账号离线模式及导入导出；官网称其密码学设计经过外部审计。本次未另行评估审计报告。
- **Likely strength:** Inference，中信心：适合需要跨设备管理验证码的人。
- **Likely weakness:** Inference，中信心：同步和长期管理增加产品范围，与即时工具的核心任务不同；不是其产品缺陷判断。
- **Key source URL:** [产品页](https://ente.com/auth/)、[源码仓库](https://github.com/ente/ente)，AGPL-3.0。仓库包含多个 Ente 产品，不把整个仓库 star 数视为 Auth 单品受欢迎程度。

### Competitor: 2FAuth
- **Positioning:** Fact，高信心：可自托管的 Web 验证器，面向桌面和移动端。[README](https://github.com/Bubka/2FAuth)
- **Relevant capability:** Fact，高信心：分组、二维码、账户编辑、TOTP/HOTP/Steam、多用户、认证、安全密钥、自动退出及多格式迁移。README 指出数据库敏感数据加密是可选项，默认关闭。
- **Likely strength:** Inference，中信心：适合愿意运维服务器、需要长期 Web 管理的人。
- **Likely weakness:** Inference，中信心：PHP/Laravel/数据库及登录系统带来部署维护成本，对纯临时取码而言过重。
- **Key source URL:** [官方 README](https://raw.githubusercontent.com/Bubka/2FAuth/master/README.md)，AGPL-3.0；本项目不复用其服务端代码。

## 3. Quick Comparison

下表已核实功能均来自上一节直接来源；“适用性”是 Inference。

| 维度 | Keylane 本次实现 | 2fa.live | Aegis | Ente Auth | 2FAuth |
|---|---|---|---|---|---|
| 目标任务 | 临时取码 / 生成配置 | 快速取码 | 移动端账户管理 | 跨设备账户管理 | 自托管账户管理 |
| 密钥持久保存 | 无 | 未核实 | 加密保险库 | 本地与 E2EE 同步方案 | 数据库，可选加密 |
| 验证码 | TOTP / HOTP | 页面有验证码输出，算法范围未核实 | TOTP / HOTP | 官网未逐项核实算法范围 | TOTP / HOTP / Steam |
| 二维码 | 生成 + 图片/粘贴/拖放识别 | 未核实 | 扫码与图片 | 扫码 | 扫码与解码 |
| 随机密钥生成 | 160 / 256 / 512 bit | 未核实 | 非本次核实重点 | 非本次核实重点 | 非本次核实重点 |
| 导入迁移 | 标准 otpauth，批量最多 50 行 | 未核实 | 多种验证器格式 | 多种验证器 | Aegis / 2FAS / Google 等 |
| 部署 | 静态文件；无数据库 | 在线网站 | Android 应用 | 应用 / Web / 服务端 | PHP / Laravel / 数据库 |
| 对本项目最有用的借鉴 | — | 单任务短路径 | 格式校验 | 清晰取码体验 | 浏览器与桌面易用性 |
| Evidence quality | 本地源码、单元与浏览器验证 | 页面可读，未审计行为 | 官方 README | 官网与源码入口 | 官方 README |

2fa.run 因访问受阻，未放入已验证能力矩阵。2FAS 的 [Android 开源仓库](https://github.com/twofas/2fas-android) 已确认，但本次未展开其完整功能，以避免用浅层信息扩充对比表。

## 4. So What?

### 3 条产品策略判断
1. **Inference，高信心：** 取码输入与输出同屏，一次粘贴即可开始计算；参考 [2fa.live](https://2fa.live/) 的短路径。
2. **Inference，高信心：** 根据用户最终要求，去掉保险库、账号、同步、备份、历史记录；Aegis 与 Ente 的持久管理能力仅用于辨明产品边界。[Aegis](https://github.com/beemdevelopment/Aegis)、[Ente](https://ente.com/auth/)
3. **Inference，高信心：** 把随机密钥、otpauth URI 和二维码作为同一个“配置生成”流程，明确与服务端绑定的关系，避免让用户误以为新密钥可直接登录第三方账户。[Key URI 格式](https://github.com/google/google-authenticator/wiki/Key-Uri-Format)

### 2 条产品风险
1. **Inference，高信心：** 用户可能将“新生成的密钥”与“平台已经绑定的密钥”混淆，界面需明确说明。[RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238)
2. **Inference，中信心：** 对几十个长期账户的用户，即时工具不如成熟验证器方便；这是定位取舍，不能靠悄悄增加持久化弥补。[Aegis](https://github.com/beemdevelopment/Aegis)

### 2 个机会
1. **Inference，中信心：** 无广告、无请求的本地计算可让临时操作更可预期；不把竞争对手的数据行为推测为事实。
2. **Inference，中信心：** 将批量取码与二维码图片识别放入独立入口，服务开发调试和桌面工作流，不让主页面变成账户管理后台。

### 3 个待验证假设
1. **Assumption，中信心：** 6 位 / 30 秒 / SHA-1 能覆盖用户大多数操作，保留高级参数。
2. **Assumption，中信心：** 每批 50 条足以满足临时操作，同时控制性能与误操作范围。
3. **Assumption，中信心：** 图片选择/粘贴比请求相机权限更适合当前桌面场景，首版不做摄像头扫码。

### 后续调研选项（不阻塞本次实现）
1. 进一步制作竞品功能卡。
2. 按使用成本整理更简短的决策矩阵。
3. 梳理下一阶段产品机会与风险。
4. 用真实使用场景验证上述三个假设。
