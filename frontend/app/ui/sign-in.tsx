'use client';

import { Button } from "./buttons"

interface SignInProps {
  className?: string;
}

export default function SignIn({ className }: SignInProps) {
  const handleSignIn = () => {
    // TODO: Implement client-side authentication
    alert('Authentication needs to be implemented for static builds');
  };

  return (
    <div className={className}>
      <Button 
        className="align-middle flex items-center w-full bg-gray-800 text-center" 
        onClick={handleSignIn}
      >
        Sign In (Not Implemented)
      </Button>
    </div>
  );
} 