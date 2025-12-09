export function normalizeAmount(raw) {
    if (typeof raw === "number" && Number.isFinite(raw))
        return raw;
    if (typeof raw === "string") {
        const match = raw.match(/-?\d+(\.\d+)?/);
        if (match) {
            const num = parseFloat(match[0]);
            if (Number.isFinite(num))
                return num;
        }
    }
    return null;
}
export function normalizeTextField(raw) {
    if (typeof raw !== "string")
        return null;
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    return trimmed;
}
