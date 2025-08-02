import HomePageWrapper from './HomePageWrapper';

// 静态生成配置
export const metadata = {
  title: 'File Transfer - 文件传输',
  description: '简单快速的文件传输工具',
}

// 启用静态生成 - 但保持客户端组件的灵活性
export const dynamic = 'auto'

export default function Page() {
  return <HomePageWrapper />;
}