import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 允许 any 类型（对于快速开发）
      "@typescript-eslint/no-explicit-any": "warn",
      // 允许空对象类型
      "@typescript-eslint/no-empty-object-type": "warn",
      // 允许未使用的变量（在开发阶段）
      "@typescript-eslint/no-unused-vars": "warn",
      // 允许缺少依赖的 useEffect
      "react-hooks/exhaustive-deps": "warn",
      // 允许缺少 alt 属性的图片
      "jsx-a11y/alt-text": "warn",
      // 允许使用 img 标签
      "@next/next/no-img-element": "warn",
    },
  },
];

export default eslintConfig;
