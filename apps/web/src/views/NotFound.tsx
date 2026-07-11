import { Link } from 'react-router-dom';
import { IconArrowLeft } from '../components/icons';

export function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="num text-[64px] font-medium leading-none text-gold/40">404</div>
      <h1 className="mt-3 text-[18px] font-semibold text-ivory">Lost in orbit</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        This page doesn’t exist — it may have deorbited, or the address has a typo.
      </p>
      <Link to="/" className="btn btn-gold mt-6 inline-flex">
        <IconArrowLeft size={14} />
        Back to launchpad
      </Link>
    </div>
  );
}
