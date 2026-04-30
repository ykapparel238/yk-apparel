export const ACTIVE_ORDER_STATUSES = ["CREATED", "PLANNED", "IN_PRODUCTION", "QA", "READY_TO_DISPATCH", "DELAYED"];

export const DISPATCH_ORDER_STATUSES = ["QA", "READY_TO_DISPATCH", "DISPATCHED"];

export function formatEnumLabel(value) {
  if (value === "QA") return "QA";
  if (value === "OTIF") return "OTIF";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
