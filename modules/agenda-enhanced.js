const eventFields = Array.isArray(createConfig.evento?.fields) ? createConfig.evento.fields : [];
const eventRecurrence = eventFields.find((field) => field.name === "recurrence");
if (eventRecurrence) {
  eventRecurrence.options = Array.isArray(eventRecurrence.options) ? eventRecurrence.options : [];
  if (!eventRecurrence.options.some(([value]) => value === "yearly")) eventRecurrence.options.push(["yearly", "Todo ano"]);
}
