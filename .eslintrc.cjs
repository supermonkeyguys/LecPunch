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
    }
  ]
};
