'use client';

/**
 * /org/whatsapp — landing redirect.
 *
 * The sidebar links to /org/whatsapp; we route the user to whichever
 * tab makes sense as their first stop. Numbers is the default (most
 * common workflow). The layout's tab nav handles the rest.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrgWhatsAppIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/org/whatsapp/numbers');
  }, [router]);
  return null;
}
