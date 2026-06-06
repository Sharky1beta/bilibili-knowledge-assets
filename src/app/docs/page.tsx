import fs from "node:fs";
import path from "node:path";

export default function DocsPage() {
  const content = fs.readFileSync(path.join(process.cwd(), "docs", "demo-architecture.md"), "utf8");

  return (
    <div className="px-6 py-6 lg:px-10">
      <header className="border-b border-[var(--line)] pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Architecture</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Current implementation guide for the demo.</p>
      </header>
      <pre className="mt-6 overflow-auto rounded-lg border border-[var(--line)] bg-white p-5 text-sm leading-6">
        {content}
      </pre>
    </div>
  );
}
