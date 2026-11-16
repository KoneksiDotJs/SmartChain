import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function PaperCard({ children, className = '' }: CardProps) {
  return <div className={`sc-paper-card ${className}`.trim()}>{children}</div>;
}

export function TactileSheet({ children, className = '' }: CardProps) {
  return <div className={`sc-tactile-sheet ${className}`.trim()}>{children}</div>;
}
