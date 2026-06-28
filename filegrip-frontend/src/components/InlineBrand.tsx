import BrandLogo from "../components/BrandLogo";

type InlineBrandProps = {
  variant?: "dark" | "light";
};

export default function InlineBrand({ variant = "dark" }: InlineBrandProps) {
  return (
    <span className="inline-flex translate-y-[3px] items-center">
      <BrandLogo variant={variant} size="xs" href="" />
    </span>
  );
}