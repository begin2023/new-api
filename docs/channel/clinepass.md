# ClinePass 账号池

ClinePass 是 Cline 的订阅制服务，一个订阅包含 5 小时 / 每周 / 每月三个用量窗口。
本功能把多个 ClinePass 账号聚合成一个号池，对用户只暴露一个模型名。

## 调用地址

本站地址：`http://106.55.38.170:3000`

OpenAI 兼容客户端的 Base URL 填 `http://106.55.38.170:3000/v1`，密钥使用本站签发的 API Key：

```bash
curl http://106.55.38.170:3000/v1/chat/completions \
  -H "Authorization: Bearer $NEW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4.1-flash","messages":[{"role":"user","content":"Hello!"}]}'
```

该地址来自 系统设置 → 通用设置 里的 `ServerAddress`，站点内 API 文档、聊天预设等处的示例地址都取自它。

## 核心概念

| 概念 | 对应到 new-api |
| --- | --- |
| 一个 ClinePass 账号 | 一个渠道，Base URL 指向 `api.cline.bot` |
| 号池 | 同一分组下的这批渠道 |
| 用户 | 一个 API Key（`token_id`） |

一个账号一个渠道，靠分组、优先级、权重和亲和性组成池，不需要额外的「账号池」实体。

## 添加账号

渠道 → 创建渠道 → 供应商列表第一项 **ClinePass**，选中后自动填好：

- Base URL：`https://api.cline.bot/api`（不要加 `/v1`，不要以 `/` 结尾）
- 模型：`deepseek-v4.1-flash`
- 模型重定向：`{"deepseek-v4.1-flash": "cline-pass/deepseek-v4.1-flash"}`
- 高级自定义路由：`/v1/chat/completions` → `/v1/chat/completions`，原生转发

只需要粘贴 API Key，保存即可。**后续新增账号走同一个入口，模型名保持不变**，用户端不需要改任何配置，
新账号自动并入同一个池。

## 对外只暴露一个模型名

- `GET /v1/models` 只返回池子里实际提供的模型名，例如 `deepseek-v4.1-flash`
- 请求其他任何模型名都会得到 `503 No available channel for model <name>`，
  包括上游真实名 `cline-pass/deepseek-v4.1-flash`
- 上游真实名只存在于渠道的「模型重定向」里，用户看不到，也不能直接指定

## 用量窗口与自动切换

后台任务按固定间隔读取每个账号的窗口用量、套餐额度上限和余额，快照存在渠道的
`channel_info` 里（不需要迁移数据库）：

- 三个窗口的用量百分比和重置时间
- 套餐额度上限（`entitlements.cline_pass.inferenceCapThreshold`，单位是 1e-8 美元）
- 余额

任一窗口到达 100% → 自动禁用该渠道；窗口重置后自动重新启用。
只处理「本功能禁用的」渠道，手动禁用和其他原因的自动禁用不会被改动；读取失败不改变任何状态。

刷新间隔由环境变量 `CLINEPASS_USAGE_REFRESH_MINUTES` 控制，默认 5 分钟，设为 0 关闭：

```
Environment=CLINEPASS_USAGE_REFRESH_MINUTES=5
```

渠道列表和渠道卡片上会显示每个窗口的剩余额度、重置时间和用量进度条。

## 按 API Key 固定账号

内置亲和性规则 `clinepass per api key`：

- 同一个 API Key 固定使用同一个账号，直到该账号某个窗口用尽才换号
- 模式是 `prefer` 而不是 `strict`：绑定的账号不可用时自动切到别的账号，不会让请求失败
- TTL 7 天，按分组隔离（不同分组是各自独立的池）
- 账号被禁用（额度用尽）时固定关系自动解除，重试成功后固定关系跟着切到新账号
- 同一 Key 调用池子里的不同模型也会落在同一个账号上

规则可以在 系统设置 → 渠道亲和性 里查看和修改，例如收窄 `model_regex` 让固定只对某些模型生效。

> 亲和性缓存保存在进程内存里（未配置 Redis 时），重启服务会清空固定关系，每个 Key
> 下一个请求会重新选一次账号。

## 计费

模型定价使用计费表达式（模型管理 → 定价），包含峰谷两档和法定节假日：

- **高峰**：北京时间周一至周五 09:00-12:00、14:00-18:00
- **低谷**：其余时间，含周末和法定节假日，价格为高峰的一半
- 节假日日期用 `year("Asia/Shanghai") == 2026 && month(...) == ... && day(...) >= ...` 写成日期窗口，
  绑定年份后过期窗口自动失效，不会在次年错误地打折

**每年 11 月**国务院公布次年放假安排后，把上一年的日期窗口复制一份改成新年份即可；
不更新只是次年节假日没有折扣，不会算错日期。

计费倍率直接体现在表达式的系数上（当前是官方价格的 0.3 倍），模型定价页面显示的就是实际计费价格。

## 已知限制

- **非流式请求上游不返回 usage**：Cline 的响应里 `usage` 为 `null`，输出 token 只能按 0 计费。
  编程 agent（Cline、Claude Code、Codex）默认走流式，流式的最后一个 chunk 带 usage，不受影响。
  非流式调用者会少计输出费用，需要留意。
- 推理模型在 `max_tokens` 过小时会返回空内容，上游报 `empty response content`（HTTP 500）。
  渠道测试和自动测试对 ClinePass 渠道默认使用流式模式来避开这一点。
- 未配置 Redis 时只支持单实例部署，亲和性缓存和用量快照的并发控制都在进程内。
- 节假日日期需要每年维护。

## 相关代码

| 位置 | 内容 |
| --- | --- |
| `service/clinepass.go` | 用量读取、窗口判断、自动禁用/启用、后台刷新 |
| `model/channel.go` | `ClinePassUsage` 快照结构 |
| `controller/clinepass.go` | 管理接口 `GET /api/channel/clinepass`、`POST /api/channel/clinepass/refresh` |
| `setting/operation_setting/channel_affinity_setting.go` | 内置的按 Key 固定规则 |
| `web/src/features/channels/lib/clinepass.ts` | 渠道预设（Base URL、模型、重定向、路由） |
| `web/src/features/channels/components/clinepass-usage.tsx` | 卡片和弹窗上的窗口展示 |
