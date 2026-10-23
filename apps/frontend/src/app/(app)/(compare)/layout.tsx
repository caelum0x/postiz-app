import { ReactNode } from 'react';

// Public, unauthenticated route group for the /compare/* SEO landing pages.
// Deliberately does not use (site)/layout.tsx's LayoutComponent, which assumes
// a logged-in organization context and would redirect an anonymous visitor.
export default async function CompareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
