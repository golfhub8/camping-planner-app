// Redirect to Subscribe page since we only have annual Pro membership now
// Reference: blueprint:javascript_stripe

import { useEffect } from 'react';
import { useLocation } from "wouter";

// Redirect /checkout to /subscribe
export default function Checkout() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to the subscribe page
    setLocation("/subscribe");
  }, [setLocation]);

  return null; // Will redirect via useEffect
}
