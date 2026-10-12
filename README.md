# Scratch Lens · Scratch 程序分析系统

专业课程设计 II 题目七：上传 Scratch 3 `.sb3` 项目，提取程序量化指标并生成分析报告。

## 运行

需要 **Node.js ≥ 22.13**（推荐 Node.js 24 LTS，使用内置 SQLite）。自动化测试另需 Python 3；应用运行不需要 Python。

```bash
cd /workspace/professional-course-design
npm ci --cache /workspace/.npm-cache
npm test
npm start
```

浏览器打开 `http://127.0.0.1:3000`。远程部署可设置 `HOST=0.0.0.0 PORT=3000 npm start`，访问方式取决于部署平台。当前云环境只验证内部请求，未配置公开访问。

点击“直接分析示例”，或者上传 `examples/demo.sb3`。页面展示得分、七个维度、角色统计、规则与积木证据，支持历史查询、删除和 JSON 导出。示例可导入 Scratch 3：绿旗运行五次移动并累积得分，空格写入列表并广播。

## 已完成的功能

- multipart 文件上传、ZIP 内 `project.json` 解析，不执行用户代码、不解压到文件系统。
- 七维计算思维静态评分（每维 0–3，总计 21），提供命中规则和积木 ID。
- 角色、积木、脚本、变量、列表、注释、自定义积木数量与类别直方图。
- 空事件脚本、疑似重复主链、不可达积木和损坏引用检查。
- 中文响应式网页、拖拽上传、示例分析、SQLite 历史、JSON 导出。
- 输入限制、错误反馈、参数化 SQL、安全 DOM 输出和 CSP 响应头。

**评分是参考 Dr. Scratch 七维模型的课程实现，不是官方算法的复刻。** 规则与局限见 [评分规则](docs/scoring.md)。不以静态分数证明运行正确性或学生能力。

## 结构

```text
src/archive.js        sb3 ZIP 解析及大小限制
src/analyzer.js       结构遍历、评分、指标、建议
src/server.js         HTTP API、SQLite 持久化
public/               页面、样式、前端交互
examples/demo.sb3     可上传示例项目
scripts/              示例生成及报告导出
tests/               评分与 HTTP / SQLite 测试
 docs/                课程报告草稿、评分规则、答辩演示
```

## 数据库与配置

默认数据库 `data/analysis.db` 在首次启动时自动创建，目录被 Git 忽略。`DB_PATH` 可指定其他数据库文件；`PORT` 默认 3000；`HOST` 默认 `127.0.0.1`。无需外部数据库、云 API 或密钥。上传原文件不持久化，只保留文件名、时间、总分与完整分析报告。

| API | 功能 |
| --- | --- |
| `GET /api/health` | 数据库健康检查 |
| `POST /api/analyze` | 上传字段 `file`，返回保存后的报告 |
| `GET /api/history` | 最近 100 条记录 |
| `GET /api/history/:id` | 获取单条完整报告 |
| `DELETE /api/history/:id` | 删除单条记录 |
| `GET /api/example` | 下载示例 sb3 |

文件最大 20 MB，`project.json` 解压最大 8 MB，ZIP 文件数最多 10,000，角色最多 500，单角色积木最多 100,000，总有效积木最多 200,000。

## 验证与限制

`npm test` 包含评分边界、影子积木、嵌套与循环引用、非法压缩包、真实 HTTP 上传/查询/删除和 SQLite 跨实例持久化测试。已使用 Chromium 验证示例分析（11/21 分）、JSON 导出、历史恢复、非法文件反馈、移动布局及删除，未出现页面 JavaScript 异常；截图在 `docs/screenshots/`。浏览器演示步骤见 [答辩演示](docs/demo.md)。

当前系统适合单机课程演示或可信网络，不含账号鉴权、租户隔离与访问限流。历史记录在访问该实例的用户之间共享。若面向公网，需要补充鉴权、CSRF 防护策略、限流、资源隔离与部署配置。AST 中的自定义扩展和部分 Scratch 积木仅计入统计；不执行 Scratch VM。重复检查为主链近似，忽略分支具体语义，不作为抄袭判定。

## 提交材料

- [课程设计报告草稿](docs/课程设计报告.md)，Word 版本为 `docs/课程设计报告.docx`。
- [评分规则](docs/scoring.md)、[答辩演示](docs/demo.md)。
- 报告中的个人信息、真实分工、实际开发经历和演示截图请按真实情况补充。任务书引用的报告格式建议文件未提供，当前报告采用常见课程设计结构。
