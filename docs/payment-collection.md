# 充值收款与联系方式

记录本站（Blue API）的充值路径、用户联系管理员的入口，以及下一步要决定的事项。
最后核对时间：2026-10-17。

## 一、当前状态：用户既充不了值，也联系不到管理员

| 检查项 | 现状 | 结果 |
| --- | --- | --- |
| 支付网关（`PayAddress` / `EpayId` / `EpayKey`、Stripe、Creem、Waffo） | 全部为空 | `enable_online_topup = false`，钱包显示「尚未启用在线充值」 |
| 合规条款确认（`payment_compliance_confirmed`） | 未确认 | `enable_redemption` 跟随它，兑换码输入框被「管理员确认合规条款之前，兑换码功能不可用」替换 |
| 充值链接（`TopUpLink`） | 未设置 | 用户拿不到任何可点的购买/联系入口 |
| 兑换码 | 0 条 | 没有可兑换的码 |
| 公告 / 关于 / 页脚 | 都为空 | 站点内没有任何联系方式 |

判断逻辑在 `controller/topup.go`：`enable_redemption` 与 `payment_compliance_confirmed` 都取自
`operation_setting.IsPaymentComplianceConfirmed()`；`enable_online_topup` 取自 `isEpayTopUpEnabled()`。

## 二、三条充值路径

### 1. 确认合规条款，启用兑换码（成本最低）

系统设置 → 支付网关设置 → 勾选合规声明。确认后：

- 钱包页出现兑换码输入框，用户在「兑换码」页面生成码后自助充值；
- 同时解锁订阅（`controller/subscription.go`）与邀请奖励（若奖励额度非 0）。

声明内容是**风险提示**：它让你确认「对外售卖 API 额度的责任在你」，不构成合法合规审查结论，
也不代表平台背书。是否接受由你自己决定。

### 2. 配置在线支付（用户自助，最省人力）

同一个页面按渠道填：

| 渠道 | 关键配置 | 备注 |
| --- | --- | --- |
| 易支付（Epay） | `PayAddress`、`EpayId`、`EpayKey` | 国内个人常用；回调走 HTTP 也能用 |
| Stripe | Secret、Webhook 密钥 | 回调通常要求 **HTTPS** |
| Creem | API Key、商品列表 | 面向海外；MoR 模式 |
| Waffo / Waffo Pancake | API Key、支付方式 | 面向海外；MoR 模式 |

### 3. 手工加额度

管理员在「用户管理」里给用户增加额度，或批量生成兑换码发给用户。
`controller/user.go` 里非零的邀请奖励同样受合规开关约束。

## 三、用户怎么联系管理员

代码里那句「请使用兑换码或联系管理员」原本只是**纯文字**，没有任何可点入口。现已补上：

- 只要在**系统设置 → 额度设置 → Top-Up Link**（`TopUpLink`）填了链接，钱包页的
  「尚未启用在线充值」和「兑换码功能不可用」两处提示下面都会出现一个「联系管理员 ↗」链接
  （新窗口打开）。改动见 `web/src/features/wallet/components/recharge-form-card.tsx`，
  文案 key 为 `Contact the administrator`（七种语言）。
- 其他可以放联系方式的位置：
  - **公告**：系统设置 → 维护设置 → `Notice`，用户登录后可见；
  - **关于 / 页脚**：系统设置 → 站点设置 → `About` / `Footer`（页脚支持 HTML，可放超链接）。

`TopUpLink` 的建议填法：QQ 群邀请链接、Telegram 群、爱发电主页，或 `mailto:你的邮箱`。

## 四、已隐藏的功能

邀请（推荐）计划的奖励已从用户界面隐藏，代码保留：

- `web/src/features/wallet/constants.ts` 的 `AFFILIATE_PROGRAM_ENABLED = false`；
- 隐藏范围：钱包页的推荐计划卡片、邀请链接、奖励转移对话框；
- 要恢复：把该常量改回 `true`；
- 注意：隐藏的只是界面。若「额度设置」里的邀请奖励（`QuotaForInviter` / `QuotaForInvitee`）
  不为 0，带 `?aff=xxx` 的旧链接注册仍会发奖励；要彻底停掉请把这两个值设为 0。

## 五、下一步要决定的事

1. **是否接受合规声明**（决定兑换码是否可用）。
2. **选支付渠道**：国内用户为主 → 易支付；海外为主 → Stripe / Creem / Waffo。
3. **回调地址**：目前站点是 `http://106.55.38.170:3000`，**没有域名也没有 HTTPS**。
   易支付可以走 HTTP；Stripe / Creem / Waffo 的 webhook 通常要求 HTTPS 公网域名，
   需要先加域名 + 证书（Nginx 或 Caddy 反向代理），否则回调收不到、支付无法自动入账。
4. **联系方式**：把 `TopUpLink` 和公告填上，用户才有路找你。
5. 额度与价格：`billing_setting.billing_expr` 是 0.3 倍、含法定节假日的峰谷表达式，
   与充值渠道无关，不需要一起改。

## 六、相关代码位置

| 用途 | 位置 |
| --- | --- |
| 充值信息接口（是否启用各渠道） | `controller/topup.go` |
| 合规开关 | `setting/operation_setting` 的 `IsPaymentComplianceConfirmed` |
| 钱包页 | `web/src/features/wallet/index.tsx` |
| 充值表单与两处提示 | `web/src/features/wallet/components/recharge-form-card.tsx` |
| 邀请奖励卡片（已隐藏） | `web/src/features/wallet/components/affiliate-rewards-card.tsx` |
| 邀请奖励设置 | 系统设置 → 额度设置 → `QuotaForInviter` / `QuotaForInvitee` |
| 充值链接设置 | 系统设置 → 额度设置 → `TopUpLink` |
