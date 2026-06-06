import { GenerateWorkbench } from "@/components/generate-workbench";
import { createDemoAsset, listAssets } from "@/lib/db/assets";

export const dynamic = "force-dynamic";

export default function GeneratePage() {
  createDemoAsset();
  const assets = listAssets();

  return (
    <div className="px-6 py-6 lg:px-10">
      <header className="border-b border-[var(--line)] pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">生成输出</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          复用一个已保存资产生成多种结果，或选择多个资产做综合对比。
        </p>
      </header>
      <div className="mt-6">
        <GenerateWorkbench assets={assets} />
      </div>
    </div>
  );
}
