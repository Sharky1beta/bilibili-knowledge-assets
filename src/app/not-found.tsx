import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md rounded-lg border border-[var(--line)] bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold">没有找到</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">请求的资产或页面不存在。</p>
        <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white">
          回到首页
        </Link>
      </div>
    </div>
  );
}
