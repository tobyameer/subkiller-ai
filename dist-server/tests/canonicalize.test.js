/**
 * Unit tests for canonicalization utilities
 * Run with: node --test dist-server/tests/canonicalize.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { canonicalizeService, detectProvider } from "../utils/canonicalize.js";

test("canonicalizeService - Tinder variations", () => {
  assert.strictEqual(canonicalizeService("Tinder Dating App: Date & Chat"), "Tinder");
  assert.strictEqual(canonicalizeService("Tinder Dating App"), "Tinder");
  assert.strictEqual(canonicalizeService("tinder"), "Tinder");
  assert.strictEqual(canonicalizeService("TINDER"), "Tinder");
});

test("canonicalizeService - Apple services", () => {
  assert.strictEqual(canonicalizeService("Apple"), "Apple");
  assert.strictEqual(canonicalizeService("Apple Services"), "Apple");
  assert.strictEqual(canonicalizeService("Apple iCloud"), "iCloud");
  assert.strictEqual(canonicalizeService("Apple Music"), "Apple Music");
});

test("canonicalizeService - Google services", () => {
  assert.strictEqual(canonicalizeService("Google Play"), "Google Play");
  assert.strictEqual(canonicalizeService("YouTube Premium"), "YouTube Premium");
  assert.strictEqual(canonicalizeService("YouTube"), "YouTube Premium");
});

test("canonicalizeService - Unknown service", () => {
  assert.strictEqual(canonicalizeService("My Custom Service"), "My Custom Service");
  assert.strictEqual(canonicalizeService("random service name"), "Random Service Name");
});

test("detectProvider - Apple", () => {
  assert.strictEqual(detectProvider("no_reply@email.apple.com"), "apple");
  assert.strictEqual(detectProvider("noreply@apple.com"), "apple");
});

test("detectProvider - Google", () => {
  assert.strictEqual(detectProvider("googleplay-noreply@google.com"), "google");
  assert.strictEqual(detectProvider("noreply@google.com"), "google");
});

test("detectProvider - Stripe", () => {
  assert.strictEqual(detectProvider("noreply@stripe.com"), "stripe");
});

test("detectProvider - Direct", () => {
  assert.strictEqual(detectProvider("noreply@talabat.com"), "direct");
  assert.strictEqual(detectProvider("support@netflix.com"), "direct");
  assert.strictEqual(detectProvider(null), null);
});

