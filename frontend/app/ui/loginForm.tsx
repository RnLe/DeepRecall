import { Button } from "./buttons";
import Link from 'next/link';

export function LoginForm() {
    return (
        <div className="w-2/4 aspect-[3/4] bg-slate-400 rounded-xl flex flex-col justify-center items-center">
            <h1 className="text-2xl font-bold text-white">Login</h1>

            <form className="flex flex-col gap-4 w-3/4">
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="username">Username</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="text" id="username" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="password">Password</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="password" id="password" />
                </div>
                <Button type="submit">Login</Button>
            </form>
            <p className="text-white mt-4">Don't have an account yet?</p>
            <Link
                href="login/register"
                className="mt-4 w-3/4 flex h-10 items-center rounded-lg bg-blue-500 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:bg-blue-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-50">Register
            </Link>
        </div>
    );
}