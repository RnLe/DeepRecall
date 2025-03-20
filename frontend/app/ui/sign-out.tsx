import { signOut } from "@/auth"
import { Button } from "./buttons"
 
export function SignOut() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut({ redirectTo: "/" })
      }}
    >
      <Button>Sign Out</Button>
    </form>
  )
}