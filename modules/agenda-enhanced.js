const eventRecurrence = createConfig.evento?.fields.find((field) => field.name === "recurrence");
if (eventRecurrence && !eventRecurrence.options.some(([value]) => value === "yearly")) eventRecurrence.options.push(["yearly", "Todo ano"]);
