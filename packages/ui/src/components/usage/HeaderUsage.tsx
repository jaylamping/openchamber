import React from 'react';
import { Popover } from '@base-ui/react/popover';
import { Icon } from '@/components/icon/Icon';
import { ProviderLogo } from '@/components/ui/ProviderLogo';
import { dropdownMenuPopupClass } from '@/components/ui/dropdown-menu.styles';
import { preloadProviderLogos } from '@/hooks/useProviderLogo';
import { useI18n } from '@/lib/i18n';
import { formatQuotaValueLabel } from '@/lib/quota';
import { runBackgroundNetworkTask } from '@/lib/background-network';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/stores/useConfigStore';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { useUIStore } from '@/stores/useUIStore';
import type { UsageWindow } from '@/types';
import { UsageGiftResetButton } from './UsageGiftResetButton';
import { formatUsageCountdown, pickTightestRow, usageTone, type UsageTone } from './usageLimits';
import { resolveQuotaProviderId } from './quotaProvider';
import { useUsageProviderGroups, type UsageLimitRow, type UsageProviderGroup } from './usageGroups';

/**
 * Provider rate limits in the desktop header.
 *
 * Two levels, like a menu-bar monitor: a strip that stays on screen all day,
 * one quiet readout per provider (its tightest limit), and a panel behind it
 * that spends space freely — a ring per provider and every limit with its bar
 * and reset countdown. The strip has to earn its place in the header; the
 * panel only has to be worth opening.
 */

const TONE_COLOR = {
  default: 'var(--status-success)',
  warning: 'var(--status-warning)',
  error: 'var(--status-error)',
} as const satisfies Record<UsageTone, string>;

const TONE_TEXT = {
  default: 'text-foreground',
  warning: 'text-[var(--status-warning)]',
  error: 'text-[var(--status-error)]',
} as const satisfies Record<UsageTone, string>;

/** Countdowns move by the minute; nothing on screen needs a faster clock. */
const useMinuteClock = (): number => {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

type Reading = { percent: number | null; label: string; tone: UsageTone };

/**
 * What a limit shows: the user's chosen side of it (used or remaining), while
 * the colour always follows how much is used — 90% remaining is fine, 90%
 * used is not, whichever way the number is printed.
 */
const useReadWindow = () => {
  const displayMode = useQuotaStore((state) => state.displayMode);
  return React.useCallback((window: UsageWindow): Reading => {
    const percent = displayMode === 'remaining' ? window.remainingPercent : window.usedPercent;
    return {
      percent: percent !== null && Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : null,
      label: formatQuotaValueLabel(window.valueLabel, percent),
      tone: usageTone(window.usedPercent),
    };
  }, [displayMode]);
};

const UsageBar: React.FC<{ reading: Reading; className?: string }> = ({ reading, className }) => (
  <span className={cn('relative block h-1 overflow-hidden rounded-full bg-[var(--interactive-border)]', className)}>
    {reading.percent !== null ? (
      <span
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${reading.percent}%`, backgroundColor: TONE_COLOR[reading.tone] }}
      />
    ) : null}
  </span>
);

const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** The provider's tightest limit at a glance, the panel's equivalent of the strip. */
const UsageRing: React.FC<{ reading: Reading | null }> = ({ reading }) => (
  <span className="relative flex size-14 shrink-0 items-center justify-center">
    <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx="28" cy="28" r={RING_RADIUS} fill="none" strokeWidth="5" stroke="var(--interactive-border)" />
      {reading && reading.percent !== null ? (
        <circle
          cx="28"
          cy="28"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          stroke={TONE_COLOR[reading.tone]}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - reading.percent / 100)}
          className="transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />
      ) : null}
    </svg>
    {/* A bare percentage: the rows beside it carry the full labels. */}
    <span className={cn('typography-micro font-semibold tabular-nums', reading ? TONE_TEXT[reading.tone] : 'text-muted-foreground')}>
      {reading && reading.percent !== null ? `${Math.round(reading.percent)}%` : '–'}
    </span>
  </span>
);

const LimitRow: React.FC<{ row: UsageLimitRow; providerId: UsageProviderGroup['providerId']; now: number; read: (window: UsageWindow) => Reading }> = ({
  row,
  providerId,
  now,
  read,
}) => {
  const reading = read(row.window);
  const countdown = formatUsageCountdown(row.window, now);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-baseline gap-2">
        {/* The name keeps its width and a long spend label ("$174.45
            remaining of $400.00") gives way instead: a cut-off name leaves
            no way to tell the rows apart. */}
        <span className="max-w-[60%] shrink-0 truncate typography-meta text-muted-foreground">
          {row.subtitle ? `${row.subtitle} · ${row.label}` : row.label}
        </span>
        <span className="flex-1" />
        <UsageGiftResetButton window={row.window} providerId={providerId} />
        <span
          title={reading.label === '-' ? undefined : reading.label}
          className={cn('min-w-0 truncate typography-meta font-medium tabular-nums', TONE_TEXT[reading.tone])}
        >
          {reading.label === '-' ? '' : reading.label}
        </span>
        <span className="w-12 shrink-0 text-right typography-micro tabular-nums text-muted-foreground">
          {countdown ?? ''}
        </span>
      </div>
      {reading.percent !== null ? <UsageBar reading={reading} /> : null}
    </div>
  );
};

const ProviderModule: React.FC<{ group: UsageProviderGroup; now: number; read: (window: UsageWindow) => Reading }> = ({ group, now, read }) => {
  const tightest = pickTightestRow(group);
  return (
    <section className="flex flex-col gap-2 px-3 py-2.5">
      <header className="flex min-w-0 items-center gap-2">
        <ProviderLogo providerId={group.providerId} className="size-4 shrink-0" />
        <span className="truncate typography-ui-label font-semibold text-foreground">{group.providerName}</span>
        {group.planLabel ? (
          <span className="shrink-0 rounded px-1 typography-micro uppercase text-muted-foreground ring-1 ring-[var(--interactive-border)]">
            {group.planLabel}
          </span>
        ) : null}
      </header>
      {group.status ? (
        <p className="typography-micro break-words text-[var(--status-warning)]">{group.status}</p>
      ) : null}
      {group.rows.length > 0 ? (
        <div className="flex items-center gap-3">
          <UsageRing reading={tightest ? read(tightest.window) : null} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {group.rows.map((row) => (
              <LimitRow key={row.key} row={row} providerId={group.providerId} now={now} read={read} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const StripItem: React.FC<{ group: UsageProviderGroup; active: boolean; read: (window: UsageWindow) => Reading }> = ({ group, active, read }) => {
  const tightest = pickTightestRow(group);
  const reading = tightest ? read(tightest.window) : null;
  return (
    // The provider the composer is pointed at reads at full strength: its
    // limit decides whether the next turn lands.
    <span className={cn('flex shrink-0 items-center gap-1.5', !active && 'opacity-60')}>
      <span className="relative flex">
        <ProviderLogo providerId={group.providerId} className="size-3.5" />
        {group.status ? (
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[var(--status-warning)]" aria-hidden="true" />
        ) : null}
      </span>
      {reading ? (
        <>
          <UsageBar reading={reading} className="w-7" />
          {/* Always a bare percentage: a spend limit's own label ("$174.45
              remaining of $400.00") belongs in the panel, not the header. */}
          {reading.percent !== null ? (
            <span className={cn('typography-micro tabular-nums', TONE_TEXT[reading.tone])}>
              {Math.round(reading.percent)}%
            </span>
          ) : null}
        </>
      ) : null}
    </span>
  );
};

const minutesSince = (lastUpdated: number | null, now: number): number | null => {
  if (lastUpdated === null) return null;
  return Math.max(0, Math.round((now - lastUpdated) / 60_000));
};

export const HeaderUsage: React.FC = () => {
  const { t } = useI18n();
  const groups = useUsageProviderGroups();
  const read = useReadWindow();
  const now = useMinuteClock();
  const [open, setOpen] = React.useState(false);
  const isLoading = useQuotaStore((state) => state.isLoading);
  const lastUpdated = useQuotaStore((state) => state.lastUpdated);
  const dropdownProviderIds = useQuotaStore((state) => state.dropdownProviderIds);
  const fetchQuotas = useQuotaStore((state) => state.fetchQuotas);
  const ensureQuotasLoadedForRuntime = useQuotaStore((state) => state.ensureLoadedForRuntime);
  const isInitialized = useConfigStore((state) => state.isInitialized);
  const activeQuotaProviderId = resolveQuotaProviderId(useConfigStore((state) => state.currentProviderId));
  const setSettingsPage = useUIStore((state) => state.setSettingsPage);
  const setSettingsDialogOpen = useUIStore((state) => state.setSettingsDialogOpen);

  // The periodic refresh only schedules; the first load is asked for here, by
  // the one place that shows usage on desktop. Asking again is a no-op.
  React.useEffect(() => {
    if (!isInitialized) return;
    void runBackgroundNetworkTask(() => ensureQuotasLoadedForRuntime());
  }, [ensureQuotasLoadedForRuntime, isInitialized]);

  React.useEffect(() => {
    if (groups.length === 0) return;
    preloadProviderLogos(groups.map((group) => group.providerId));
  }, [groups]);

  // Nothing chosen on the Usage settings page: the header stays as it was.
  if (groups.length === 0) return null;

  const minutesAgo = minutesSince(lastUpdated, now);
  const openSettings = () => {
    setOpen(false);
    setSettingsPage('usage');
    setSettingsDialogOpen(true);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={t('header.usage.triggerAria')}
        className={cn(
          'app-region-no-drag flex h-8 min-w-0 items-center gap-3 overflow-hidden rounded-md px-2 transition-colors',
          'hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-interactive-hover',
        )}
      >
        {groups.map((group) => (
          <StripItem key={group.providerId} group={group} active={group.providerId === activeQuotaProviderId} read={read} />
        ))}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-[120]">
          <Popover.Popup
            aria-label={t('header.services.rateLimits')}
            className={cn(dropdownMenuPopupClass, 'flex w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0')}
          >
            <div className="flex items-center gap-2 border-b border-[var(--interactive-border)] px-3 py-2">
              <Icon name="donut-chart" className="size-4 text-muted-foreground" />
              <span className="typography-ui-label font-semibold text-foreground">{t('header.services.rateLimits')}</span>
              <span className="min-w-0 flex-1 truncate typography-micro text-muted-foreground">
                {minutesAgo === null ? '' : minutesAgo === 0
                  ? t('header.usage.checkedJustNow')
                  : t('header.usage.checkedAgo', { minutes: minutesAgo })}
              </span>
              <button
                type="button"
                onClick={() => void fetchQuotas(dropdownProviderIds)}
                disabled={isLoading}
                aria-label={t('header.services.refreshRateLimitsAria')}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <Icon name="refresh" className={cn('size-3.5', isLoading && 'animate-spin motion-reduce:animate-none')} />
              </button>
              <button
                type="button"
                onClick={openSettings}
                aria-label={t('header.usage.settingsAria')}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon name="settings-3" className="size-3.5" />
              </button>
            </div>
            <div className="max-h-[min(70vh,40rem)] divide-y divide-[var(--interactive-border)] overflow-y-auto">
              {groups.map((group) => <ProviderModule key={group.providerId} group={group} now={now} read={read} />)}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
