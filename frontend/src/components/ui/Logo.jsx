// DocuGuard "DG" interlocking monogram. Uses currentColor so it themes against
// any background. Replace frontend/public/logo.svg to swap in an exact brand asset.
export default function Logo({ size = 28, className, strokeWidth = 7.5 }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* D */}
      <path d="M16 50 V14 H28 C39 14 44 22 44 32 C44 42 39 50 28 50 Z" />
      {/* G */}
      <path d="M58 24 C53 14 41 12 33 18 C25 24 25 40 34 46 C44 52 56 49 58 40 V32 H48" />
    </svg>
  );
}
