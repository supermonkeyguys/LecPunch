module.exports = {
  root: true,
  extends: ["@lecpunch/eslint-config"],
  ignorePatterns: ["dist", "node_modules"],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parserOptions: {
        project: [
          "./apps/web/tsconfig.json",
          "./apps/api/tsconfig.json",
          "./packages/shared/tsconfig.json",
          "./packages/ui/tsconfig.json"
        ]
      }
    },
    {
      files: ["packages/shared/src/**/*.{js,cjs,mjs}"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "Program",
            message:
              "packages/shared/src 仅允许 TypeScript 源码，禁止提交 .js/.cjs/.mjs 构建产物。"
          }
        ]
      }
    }
  ]
};
