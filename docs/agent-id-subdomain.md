# Agent ID 子域名交付

部署项目位于 [`apps/agent-id`](../apps/agent-id/README.md)，完整源码、公共数据、独立依赖锁、Docker / Compose / Nginx 样例均在其中。

目标域名：**https://agent-id.tagai.fun/**。由技术人员完成 DNS、HTTPS、服务部署与验收后，在主站构建环境设置 `VITE_AGENT_ID_ATLAS_ENABLED=true`，发布桌面和移动端菜单入口。此 PR 不触发生产部署。
