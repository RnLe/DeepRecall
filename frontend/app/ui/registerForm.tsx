import { Button } from "./buttons";
// To allow for navigation between pages without a full page refresh
// This is a localized wrapper around the `Link` component from `next/link`
import { Link } from '@/src/i18n/routing';
import { useTranslations } from 'next-intl';

export function RegisterForm() {
    const u = useTranslations('General');
    const t = useTranslations('RegisterForm');
    return (
        <div className="w-2/4 aspect-[3/4] bg-slate-400 rounded-xl flex flex-col justify-center items-center">
            <h1 className="text-2xl font-bold text-white mb-5">{t('title')}</h1>

            <form className="flex flex-col gap-4 w-3/4">
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="username">{u('username')}</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="text" id="username" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="password">{u('email')}</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="email" id="email" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="password">{u('password')}</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="password" id="password" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-white" htmlFor="password">{t('confirmPassword')}</label>
                    <input className="rounded-md p-2 bg-slate-500 text-white" type="password" id="password" />
                </div>
                <Button type="submit">{u('register')}</Button>
            </form>
            <Link href="../login" className="text-white flex flex-row items-center mt-4">
                <span className="mr-2 text-3xl">←</span>
                <p>{t('backLogin')}</p>
            </Link>
        </div>
    );
}