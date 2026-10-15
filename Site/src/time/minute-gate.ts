const MS_PER_MINUTE = 60_000;

/**
 * Lets through the first date of each wall-clock minute — cheap enough to call on
 * every animation frame. Every time zone's offset is a whole number of minutes, so
 * a new UTC minute is a new local minute, Tehran's included.
 */
export function createMinuteGate(onChange: (date: Date) => void): (date: Date) => void {
  let lastMinute: number | null = null;
  return (date) => {
    const minute = Math.floor(date.getTime() / MS_PER_MINUTE);
    if (minute === lastMinute) return;
    lastMinute = minute;
    onChange(date);
  };
}
