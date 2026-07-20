type KoverLogoProps = {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: {
    mark: "h-8 w-8",
    title: "text-lg",
    subtitle: "text-[10px]",
  },
  md: {
    mark: "h-10 w-10",
    title: "text-xl",
    subtitle: "text-xs",
  },
  lg: {
    mark: "h-12 w-12",
    title: "text-2xl",
    subtitle: "text-xs",
  },
};

export function KoverLogo({ showText = true, size = "md" }: KoverLogoProps) {
  const classes = sizeClass[size];

  return (
    <span className="inline-flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`${classes.mark} relative inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm ring-1 ring-slate-900/10`}
      >
        <span className="absolute inset-[3px] rounded-[10px] bg-gradient-to-br from-sky-400 via-emerald-400 to-slate-900" />
        <svg
          className="relative h-[68%] w-[68%]"
          fill="none"
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 9v30"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="6"
          />
          <path
            d="M33 10 17 24l17 14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="6"
          />
          <path
            d="M37 8v32"
            opacity="0.28"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
      </span>
      {showText ? (
        <span className="leading-none">
          <span className={`block font-semibold tracking-normal text-slate-950 ${classes.title}`}>
            Kover
          </span>
          <span className={`mt-1 block font-medium uppercase tracking-normal text-sky-700 ${classes.subtitle}`}>
            Insurance Workspace
          </span>
        </span>
      ) : null}
    </span>
  );
}
