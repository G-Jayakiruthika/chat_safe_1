'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEngine } = require('../src/engine');

test('engine.analyze routes scam messages to Kavach and civic complaints to Urimai', async () => {
  const engine = createEngine();

  const scamRes = await engine.analyze({
    text: 'CBI officer says you are under digital arrest. Transfer ₹2,00,000 to verify. Do not tell family.',
    lang: 'en',
  });
  assert.equal(scamRes.intent, 'SCAM');
  assert.ok(scamRes.score >= 70);
  assert.match(scamRes.complaint, /NATIONAL CYBER CRIME REPORTING PORTAL/);

  const civicRes = await engine.analyze({
    text: 'The panchayat water pipe on my street broke 3 days ago and no one is fixing it.',
    lang: 'ta',
  });
  assert.equal(civicRes.intent, 'CIVIC');
  assert.equal(civicRes.level, 'civic');
  assert.ok(civicRes.urimaiKit);
  assert.match(civicRes.urimaiKit.department, /Water/i);
});

test('engine.agent performs Speed-Dial 9 voice handoff for civic & scam utterances', async () => {
  const engine = createEngine();

  const civic = await engine.agent({
    text: 'The panchayat water pipe on my street broke 3 days ago and no one is fixing it.',
    lang: 'en',
  });
  assert.equal(civic.mode, 'urimai');
  assert.equal(civic.mood, 'civic');
  assert.ok(civic.urimaiKit);

  const scam = await engine.agent({
    text: 'A man asked for my OTP for the bank and threatened to block my account.',
    lang: 'en',
  });
  assert.equal(scam.mode, 'scan');
  assert.equal(scam.intent, 'SCAM');
});

test('engine.redact masks personal identifiers with [REDACTED] tags', async () => {
  const engine = createEngine();
  const res = await engine.redact({
    text: 'Dear Ramesh Kumar, call +91 98401 22334 or pay rajesh.trader@ybl for Aadhaar 4421 8890 1122.',
  });
  assert.ok(res.count >= 3);
  assert.match(res.redacted, /\[PHONE_REDACTED\]/);
  assert.match(res.redacted, /\[UPI_REDACTED\]/);
  assert.match(res.redacted, /\[ID_REDACTED\]/);
});

test('engine.radar returns city-filtered scams, civic watch & video reels', async () => {
  const engine = createEngine();
  const all = await engine.radar({ city: 'All' });
  assert.ok(all.scams.length >= 4);
  assert.ok(all.civic.length >= 3);
  assert.ok(all.reels.length >= 3);
});
