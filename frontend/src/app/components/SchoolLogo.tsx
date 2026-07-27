import { useEffect, useState } from 'react';
import type { School } from '../../types/entities';
import { getApiBaseUrl } from '../lib/http';

function schoolMark(school: Pick<School, 'name' | 'shortName'>) {
  return Array.from(school.shortName || school.name).slice(0, 2).join('');
}

function resolveSchoolLogoUrl(school: Pick<School, 'id' | 'logoUrl'>) {
  if (!school.logoUrl || !/^https?:\/\//i.test(school.logoUrl)) {
    return school.logoUrl;
  }

  return `${getApiBaseUrl()}/schools/${encodeURIComponent(school.id)}/logo`;
}

export function SchoolLogo({
  school,
  compact = false,
}: {
  school: Pick<School, 'id' | 'name' | 'shortName' | 'logoUrl'>;
  compact?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const logoUrl = resolveSchoolLogoUrl(school);

  useEffect(() => {
    setImageFailed(false);
  }, [school.id, school.logoUrl]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-center font-semibold text-slate-800 ${
        compact ? 'h-12 w-12 p-1.5 text-[12px]' : 'h-14 w-14 p-2 text-[13px]'
      }`}
    >
      {!logoUrl || imageFailed ? (
        schoolMark(school)
      ) : (
        <img
          src={logoUrl}
          alt={`${school.name}校徽`}
          loading={compact ? 'lazy' : 'eager'}
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}
