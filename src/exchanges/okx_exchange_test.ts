import { assertEquals, assertThrows } from "https://deno.land/std@0.210.0/testing/asserts.ts";
import { toOkxInstrument } from "./okx_exchange.ts";

deno.test("toOkxInstrument formats standard pair", () => {
  assertEquals(toOkxInstrument("BTC/USDT"), "BTC-USDT");
});

deno.test("toOkxInstrument trims whitespace", () => {
  assertEquals(toOkxInstrument(" eth / usd "), "ETH-USD");
});

deno.test("toOkxInstrument throws for invalid pair", () => {
  assertThrows(() => toOkxInstrument("BTC"));
});
