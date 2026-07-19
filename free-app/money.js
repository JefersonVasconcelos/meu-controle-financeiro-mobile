const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function parseBRL(input) {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  if (input === null || input === undefined) return NaN;

  let value = String(input).trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!value) return NaN;

  const negative = value.startsWith("-");
  value = value.replace(/[^0-9.,]/g, "");
  if (!value) return NaN;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  const decimalPos = Math.max(lastComma, lastDot);
  let normalized;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = value.slice(0, decimalPos).replace(/[.,]/g, "") + "." + value.slice(decimalPos + 1).replace(/[.,]/g, "");
  } else if (lastComma >= 0) {
    const decimals = value.length - lastComma - 1;
    normalized = decimals === 3 && value.indexOf(",") === lastComma
      ? value.replace(/,/g, "")
      : value.slice(0, lastComma).replace(/,/g, "") + "." + value.slice(lastComma + 1);
  } else if (lastDot >= 0) {
    const decimals = value.length - lastDot - 1;
    normalized = decimals === 3 && value.indexOf(".") === lastDot
      ? value.replace(/\./g, "")
      : value.slice(0, lastDot).replace(/\./g, "") + "." + value.slice(lastDot + 1);
  } else {
    normalized = value;
  }

  const result = Number(normalized) * (negative ? -1 : 1);
  return Number.isFinite(result) ? Math.round((result + Number.EPSILON) * 100) / 100 : NaN;
}

export function formatBRL(value) {
  const number = Number(value);
  return BRL.format(Number.isFinite(number) ? number : 0);
}

export function toCents(value) {
  const number = typeof value === "number" ? value : parseBRL(value);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
}
