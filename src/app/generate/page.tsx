import { GenerateWorkbench } from "@/components/generate-workbench";
import { createDemoAsset, listAssets } from "@/lib/db/assets";

export default function GeneratePage() {
  createDemoAsset();
  const assets = listAssets();

  return (
    <div className="px-6 py-6 lg:px-10">
      <header className="border-b border-[var(--line)] pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Generate outputs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Reuse one saved asset for multiple output modes, or select several assets for a synthesized answer.
        </p>
      </header>
      <div className="mt-6">
        <GenerateWorkbench assets={assets} />
      </div>
    </div>
  );
}
