import Link from "next/link";

type Props = {
  href: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
};

const styles = {
  primary: "bg-mauve text-white hover:bg-[#6f4353] active:bg-[#5e3846]",
  secondary: "border border-mauve/40 bg-transparent text-mauve hover:bg-blush/40",
};

export function ButtonLink({ href, variant = "primary", children, className = "" }: Props) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-7 text-base font-medium transition-colors ${styles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
