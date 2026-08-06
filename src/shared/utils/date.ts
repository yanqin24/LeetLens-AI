export function nowIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function addDaysToNowIso(days: number): string {
  return addDaysIso(nowIso(), days);
}

export function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfToday(): Date {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  date.setMilliseconds(date.getMilliseconds() - 1);
  return date;
}

export function dateInputToIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 9, 0, 0, 0);
  return date.toISOString();
}

export function isoToDateInput(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(): Date {
  const date = startOfToday();
  const day = date.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysFromMonday);
  return date;
}
