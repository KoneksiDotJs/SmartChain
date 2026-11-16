import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export function SmartChainLogoIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <path d="M13 17h8M17 13v8" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3l7 3v6c0 4.5-3 8.2-7 9.5-4-1.3-7-5-7-9.5V6l7-3z" />
      <path d="M9.5 12.2l1.8 1.8 3.5-3.6" />
    </svg>
  );
}

export function WifiOffIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 2l20 20" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M5 12.5a10 10 0 0 1 5.2-2.6" />
      <path d="M10.7 5.1A15 15 0 0 1 22 9" />
      <circle cx="12" cy="19.5" r="1" />
    </svg>
  );
}

export function TruckRouteIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="6" width="13" height="10" rx="2" />
      <path d="M15 10h4l3 3v3h-7v-6z" />
      <circle cx="6.5" cy="18" r="2" />
      <circle cx="18.5" cy="18" r="2" />
    </svg>
  );
}

export function TrendChartIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 4 3 5-6" />
    </svg>
  );
}
