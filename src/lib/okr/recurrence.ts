const shanghaiDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function nextActionDueDate(input: {
  dueDate: Date | null;
  completedAt: Date;
  recurrenceType: "DAILY" | "WEEKLY";
  recurrenceInterval: number;
  recurrenceDays: string | null;
}): Date {
  const parts = Object.fromEntries(shanghaiDate.formatToParts(input.dueDate ?? input.completedAt)
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (input.recurrenceType === "DAILY") {
    next.setUTCDate(next.getUTCDate() + input.recurrenceInterval);
    return next;
  }

  const weekday = next.getUTCDay() || 7;
  const days = [...new Set((input.recurrenceDays ?? "").split(",").map(Number))].sort((left, right) => left - right);
  const later = days.find((day) => day > weekday);
  next.setUTCDate(next.getUTCDate() + (later ? later - weekday : input.recurrenceInterval * 7 - weekday + days[0]));
  return next;
}
