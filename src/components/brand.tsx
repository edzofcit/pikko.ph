import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Pikko.ph home">
      <span className={`${compact ? "h-7 w-7" : "h-9 w-9"} relative grid place-items-center rounded-full bg-[var(--lime)] shadow-[inset_0_0_0_1px_rgb(23_34_26_/_18%)]`}>
        <span className="h-[42%] w-[42%] rounded-full bg-[var(--forest)]" />
        <span className="absolute right-[13%] top-[18%] h-[13%] w-[13%] rounded-full bg-[var(--lime)]" />
      </span>
      <span className={`${compact ? "text-base" : "text-xl"} font-black tracking-[-0.045em]`}>
        pikko<span className="text-[var(--coral)]">.ph</span>
      </span>
    </Link>
  );
}
