'use client';

import { Button } from "./buttons"
 
export function SignOut() {
  const handleSignOut = () => {
    // TODO: Implement client-side authentication
    alert('Authentication needs to be implemented for static builds');
  };

  return (
    <div>
      <Button onClick={handleSignOut}>Sign Out (Not Implemented)</Button>
    </div>
  );
}