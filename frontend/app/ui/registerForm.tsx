import { Button } from "./buttons";
import Link from 'next/link';

export function RegisterForm() {
    return (
        <div className="w-2/4 aspect-[3/4] bg-slate-400 rounded-xl flex flex-col justify-center items-center">
            <h1 className="text-2xl font-bold text-white mb-5">Register</h1>

            <form className="flex flex-col gap-4 w-3/4">
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="username">Username</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="text" id="username" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="email">Email</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="email" id="email" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="password">Password</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="password" id="password" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="confirmPassword">Confirm Password</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="password" id="confirmPassword" />
                </div>
                <Button type="submit">Register</Button>
            </form>
            <Link href="../login" className="text-white flex flex-row items-center mt-4">
                <span className="mr-2 text-3xl">←</span>
                <p>Back to Login</p>
            </Link>
        </div>
    );
}