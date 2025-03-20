import { signIn } from "@/auth"

import { Button } from "./buttons"

interface SignInProps {
  className?: string;
}

export default function SignIn({ className }: SignInProps) {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("github", { redirectTo: "/" })
      }}
      className={className}
    >
      <Button className="align-middle flex items-center w-full bg-gray-800 text-center" type="submit">Sign In with GitHub</Button>
    </form>
  )
} 