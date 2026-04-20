# 成员准入白名单导入与预发验证手册（2026-04-20）

## 目标

用于支持 `Phase A4`：

- 白名单初始化导入（CSV / JSON）
- 字段标准化规则明确
- 预发环境端到端注册验证

## 导入脚本

API 工作区已提供脚本：

```bash
pnpm --filter @lecpunch/api import-eligibility -- <path-to-csv-or-json>
```

示例：

```bash
pnpm --filter @lecpunch/api import-eligibility -- ./data/member-eligibility.csv
pnpm --filter @lecpunch/api import-eligibility -- ./data/member-eligibility.json
```

脚本行为：

- 自动读取 `DEFAULT_TEAM_NAME` 对应团队（不存在则创建）
- 按 `teamId + studentId` 做 upsert
- 同学号重复导入时更新 `realName/status/note`

## 文件格式

### CSV

表头支持字段：

- 必填：`studentId`, `realName`
- 可选：`status`, `note`

示例：

```csv
studentId,realName,status,note
202400000001,Alice Zhang,allowed,first batch
202400000002,Bob Li,blocked,manual block
```

### JSON

顶层必须是数组，元素字段同 CSV：

```json
[
  { "studentId": "202400000001", "realName": "Alice Zhang", "status": "allowed" },
  { "studentId": "202400000002", "realName": "Bob Li", "status": "blocked", "note": "manual block" }
]
```

## 标准化规则

脚本与 API service 共用同一套规则：

- `studentId`: `trim()`
- `realName`: `trim()` 后将连续空白压缩为一个空格
- `status`: 仅允许 `allowed|blocked`，缺省值为 `allowed`
- `note`: `trim()` 后空串转为 `undefined`

## 预发上线前流程

1. 准备白名单文件（CSV/JSON），抽样确认学号与实名准确。
2. 在预发环境执行导入脚本，记录脚本输出（文件路径、导入数量、团队名）。
3. 执行注册端到端验证：
   - 样本 A：学号+实名匹配，应注册成功。
   - 样本 B：学号不存在，应返回 `AUTH_REGISTRATION_NOT_ELIGIBLE`。
   - 样本 C：实名不匹配，应返回 `AUTH_REGISTRATION_REALNAME_MISMATCH`。
   - 样本 D：`blocked` 学号，应返回 `AUTH_REGISTRATION_STUDENT_ID_BLOCKED`。
4. 记录验证结果并归档到发布单。

## 常见排错

- 报错 `Unsupported file extension`：
  - 仅支持 `.csv` / `.json`。
- 报错 `Unsupported status`：
  - `status` 字段只能是 `allowed` 或 `blocked`。
- 报错 `missing studentId or realName`：
  - 检查 CSV 表头与字段名，必须是 `studentId` 与 `realName`。
- 导入成功但注册失败：
  - 复查 `DEFAULT_TEAM_NAME` 是否与注册目标团队一致；
  - 复查实名字符串是否存在空白字符差异（全角/半角需先清洗）。
