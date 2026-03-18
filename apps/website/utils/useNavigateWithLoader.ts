"use client";
import { useRouter } from 'next/navigation';
import NProgress from 'nprogress';

export function useNavigateWithLoader() {
  const router = useRouter();

  return (url: string) => {
    NProgress.start();
    router.push(url);
  };
}
