'use client';

import { useParams } from 'next/navigation';
import React from 'react';
import { LoginScreen } from '@/components/auth/LoginScreen';

export default function RoleLoginPortalPage() {
  const params = useParams<{ portal: string }>();
  return <LoginScreen portalSlug={params.portal} />;
}
