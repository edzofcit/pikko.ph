"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export function MerchantSiteScopeSelect({
  sites,
  selectedSiteId,
}: {
  sites: Array<{ id: string; name: string }>;
  selectedSiteId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="block">
      <span className="sr-only">Active site</span>
      <select
        aria-label="Active site"
        value={selectedSiteId}
        disabled={isPending}
        onChange={(event) => {
          const site = event.target.value;
          startTransition(() => {
            const params = new URLSearchParams(window.location.search);
            params.delete("page");
            if (site) params.set("site", site);
            else params.delete("site");
            const query = params.toString();
            router.push(query ? `${pathname}?${query}` : pathname);
          });
        }}
        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-bold text-[var(--forest)] disabled:opacity-60"
      >
        <option value="">All sites</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  );
}
