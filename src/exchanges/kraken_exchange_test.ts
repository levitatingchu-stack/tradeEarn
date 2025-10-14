import { assertEquals, assertThrows } from "https://deno.land/std@0.214.0/testing/asserts.ts";
import { toKrakenPair } from "./kraken_exchange.ts";

Deno.test("maps btc/usdt to XBTUSDT", () => {
  assertEquals(toKrakenPair("btc/usdt"), "XBTUSDT");
});

Deno.test("maps eth/eur to ETHEUR", () => {
  assertEquals(toKrakenPair("ETH/EUR"), "ETHEUR");
});

Deno.test("throws on invalid pair", () => {
  assertThrows(() => toKrakenPair("BTC"));
});
