import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PrismGradient } from '@/components/shadcn/ui/prism-gradient';

const CONTENT_WIDTH: Record<'sm' | 'md', string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
};

export interface AuthPageShellV2Props {
  /** First hero line (serif italic). Falls back to the shared auth hero copy. */
  heroTitle1?: string;
  /** Second hero line (bold). */
  heroTitle2?: string;
  heroDescription?: string;
  /** Width of the right-hand content column. Defaults to 'sm'. */
  contentWidth?: 'sm' | 'md';
  children: React.ReactNode;
}

/**
 * Shared split-screen shell for every v2 auth/onboarding page: a moving
 * gradient background, a hero copy column on the left (hidden below lg), and
 * a glass content column on the right holding the form.
 *
 * Extracted from LoginPageV2/SignUpPageV2, which had this markup duplicated
 * byte-for-byte. `children` must land directly inside the on-glass wrapper —
 * an extra element around it changes how `max-w` and flex centering resolve.
 */
export function AuthPageShellV2({
  heroTitle1,
  heroTitle2,
  heroDescription,
  contentWidth = 'sm',
  children,
}: AuthPageShellV2Props) {
  const { t } = useTranslation();

  return (
    <div className="shadcn-reference relative min-h-svh overflow-hidden">
      {/* The gradient backs the whole page rather than one column, so both the
          copy and the form sit over it. */}
      <PrismGradient noise={{ opacity: 0.18, scale: 0.8 }} />
      {/* The gradient runs light in places, which would swallow the white copy
          on the left. This scrim darkens that half just enough to keep the
          text legible without hiding the animation behind it. */}
      <div
        className="absolute inset-0 z-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(90deg, hsl(0 0% 0% / 0.55) 0%, hsl(0 0% 0% / 0.4) 55%, hsl(0 0% 0% / 0.45) 100%)',
        }}
      />

      <div className="relative z-10 grid min-h-svh lg:grid-cols-[48fr_52fr]">
        {/* Copy column. Hidden below lg, where the form takes the full width. */}
        <div className="hidden flex-col justify-between p-10 lg:flex">
          <Link to="/" className="flex w-fit items-center gap-2.5">
            <img src="/devlane-2-dark-no-bg.png" alt="" className="size-7 object-contain" />
            <span className="text-lg font-semibold text-white">Devlane</span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-5xl leading-[0.95] tracking-tighter text-white">
              <span className="block font-serif font-light italic">
                {heroTitle1 ?? t('auth.hero.title1', 'Plan the work.')}
              </span>
              <span className="block font-bold">
                {heroTitle2 ?? t('auth.hero.title2', 'Ship the product.')}
              </span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              {heroDescription ??
                t(
                  'auth.hero.description',
                  'Issue tracking and project management for development teams. Organise work into projects, cycles, and modules, and keep everyone on the same page.',
                )}
            </p>
          </div>

          <p className="text-xs text-white/60">
            {t('auth.copyright', '© {{year}} Devlane. All rights reserved.', {
              year: new Date().getFullYear(),
            })}
          </p>
        </div>

        <div className="flex items-center justify-center p-6 md:p-10">
          {/* No card: the form sits straight on the gradient. It still needs
              the on-glass palette, since the backdrop is dark in every theme
              and the default near-black text would drop out against it. */}
          <div className={`shadcn-reference-on-glass w-full ${CONTENT_WIDTH[contentWidth]}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
