import Link from "next/link";

type CategoryPillsProps = {
  categories: string[];
  hasUncategorized: boolean;
  selectedCategory?: string;
};

export function CategoryPills({
  categories,
  hasUncategorized,
  selectedCategory,
}: CategoryPillsProps) {
  const pills = [
    { label: "All", value: undefined },
    ...categories.map((category) => ({ label: category, value: category })),
    ...(hasUncategorized
      ? [{ label: "Uncategorized", value: "uncategorized" }]
      : []),
  ];

  return (
    <nav aria-label="Product categories" className="flex flex-wrap gap-2">
      {pills.map((pill) => {
        const isActive = pill.value === selectedCategory;
        const href = pill.value
          ? `/?category=${encodeURIComponent(pill.value)}`
          : "/";

        return (
          <Link
            key={pill.label}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {pill.label}
          </Link>
        );
      })}
    </nav>
  );
}
