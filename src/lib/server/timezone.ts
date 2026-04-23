type ZonedParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
	const cacheKey = timeZone;
	const cached = formatterCache.get(cacheKey);
	if (cached) return cached;

	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	formatterCache.set(cacheKey, formatter);
	return formatter;
}

export function getTimeZoneParts(date: Date, timeZone: string): ZonedParts {
	const parts = getFormatter(timeZone)
		.formatToParts(date)
		.reduce<Record<string, string>>((acc, part) => {
			if (part.type !== "literal") {
				acc[part.type] = part.value;
			}
			return acc;
		}, {});

	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		second: Number(parts.second),
	};
}

function getOffsetMinutes(date: Date, timeZone: string): number {
	const parts = getTimeZoneParts(date, timeZone);
	const zonedAsUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	);

	return Math.round((zonedAsUtc - date.getTime()) / 60000);
}

function formatOffset(minutes: number): string {
	const sign = minutes >= 0 ? "+" : "-";
	const absolute = Math.abs(minutes);
	const hours = Math.floor(absolute / 60);
	const mins = absolute % 60;
	return `${sign}${pad2(hours)}:${pad2(mins)}`;
}

export function getDateKeyInTimeZone(date: Date, timeZone: string): string {
	const parts = getTimeZoneParts(date, timeZone);
	return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function getPathPartsInTimeZone(date: Date, timeZone: string): {
	year: number;
	month: string;
	day: string;
} {
	const parts = getTimeZoneParts(date, timeZone);
	return {
		year: parts.year,
		month: pad2(parts.month),
		day: pad2(parts.day),
	};
}

export function toZonedISOString(date: Date, timeZone: string): string {
	const parts = getTimeZoneParts(date, timeZone);
	const offsetMinutes = getOffsetMinutes(date, timeZone);
	return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(
		parts.hour,
	)}:${pad2(parts.minute)}:${pad2(parts.second)}${formatOffset(offsetMinutes)}`;
}
