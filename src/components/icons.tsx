// Pictogrammes de l'interface : un seul trait (2 px, bouts arrondis), dessinés sur une grille de 20 px.
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.5l4 4 8-9" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4v12M4 10h12" />
  </Icon>
);

export const IconArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 10H4M9 5l-5 5 5 5" />
  </Icon>
);

export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </Icon>
);

export const IconUndo = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4L3 8l4 4" />
    <path d="M3 8h9a5 5 0 010 10H9" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3v10M6 9l4 4 4-4M4 16h12" />
  </Icon>
);

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14V4M6 8l4-4 4 4M4 16h12" />
  </Icon>
);

export const IconLink = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 11.5a3.5 3.5 0 005 0l2.5-2.5a3.5 3.5 0 00-5-5l-1 1" />
    <path d="M11.5 8.5a3.5 3.5 0 00-5 0L4 11a3.5 3.5 0 005 5l1-1" />
  </Icon>
);

export const IconEyeOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 10s2.7-5 7.5-5c1.2 0 2.3.3 3.2.8M17.5 10s-2.7 5-7.5 5c-1.2 0-2.3-.3-3.2-.8" />
    <path d="M8.2 11.8a2.5 2.5 0 013.6-3.6M3 17L17 3" />
  </Icon>
);

export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5z" />
    <circle cx="10" cy="10" r="2.5" />
  </Icon>
);

export const IconCards = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="11" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="11" width="6" height="6" rx="1" />
    <rect x="11" y="11" width="6" height="6" rx="1" />
  </Icon>
);

export const IconText = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 5h14M3 9h14M3 13h14M3 17h8" />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="9" r="5" />
    <path d="M13 13l4 4" />
  </Icon>
);

export const IconImage = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <circle cx="7.5" cy="8.5" r="1.5" />
    <path d="M17 13l-4-4-7 7" />
  </Icon>
);

export const IconPrinter = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 7V3h8v4M6 14H4a1 1 0 01-1-1V8a1 1 0 011-1h12a1 1 0 011 1v5a1 1 0 01-1 1h-2" />
    <path d="M6 11h8v6H6z" />
  </Icon>
);

export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 8l5 5 5-5" />
  </Icon>
);
