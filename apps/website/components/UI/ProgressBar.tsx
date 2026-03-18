import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import './progressbar-orange.css';

NProgress.configure({ showSpinner: false });

export default function ProgressBar() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      NProgress.start();
      setTimeout(() => {
        NProgress.done();
      }, 400); // short delay for effect
      prevPath.current = pathname;
    }
  }, [pathname]);

  return null;
}
