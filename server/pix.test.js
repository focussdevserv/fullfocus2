import test from "node:test";
import assert from "node:assert/strict";
import { pixPayload, pixQrDataUrl } from "./pix.js";

test("gera payload Pix copia e cola com CRC valido", () => {
  const payload = pixPayload({ key: "contato@focussdev.art", amount: 199.9, merchantName: "Focussdev" });
  assert.match(payload, /^000201/);
  assert.match(payload, /contato@focussdev\.art/);
  assert.match(payload, /6304[0-9A-F]{4}$/);
});

test("gera QR Code Pix em data URL", async () => {
  const payload = pixPayload({ key: "contato@focussdev.art", amount: 199.9 });
  const qr = await pixQrDataUrl(payload);
  assert.match(qr, /^data:image\/png;base64,/);
});
