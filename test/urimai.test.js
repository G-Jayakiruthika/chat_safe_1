'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUrimaiKit, STATE_PORTALS } = require('../src/urimai');
const { classifyIntent } = require('../src/rules');

test('classifyIntent routes water pipe & broken road to CIVIC Urimai', () => {
  const water = classifyIntent('The panchayat water pipe on my street broke 3 days ago and no one is fixing it.');
  assert.equal(water.intent, 'CIVIC');
  assert.match(water.department, /Water/i);

  const road = classifyIntent('Deep potholes and broken road near Ward 4 school');
  assert.equal(road.intent, 'CIVIC');
  assert.match(road.department, /Public Works|PWD|Highways/i);
});

test('classifyIntent routes bank OTP & digital arrest to SCAM Kavach', () => {
  const otp = classifyIntent('A man asked for my OTP for the bank');
  assert.equal(otp.intent, 'SCAM');

  const cbi = classifyIntent('CBI officer says I am under digital arrest. Transfer ₹1,50,000 now.');
  assert.equal(cbi.intent, 'SCAM');
});

test('buildUrimaiKit generates bilingual letters, 5-signature metadata, CM portal bypass & proxy link', () => {
  const kit = buildUrimaiKit({
    text: 'The panchayat water pipe on my street broke 3 days ago.',
    lang: 'ta',
    location: 'Ward 12, Coimbatore',
    state: 'Tamil Nadu',
  });
  assert.match(kit.kitId, /^URM-/);
  assert.match(kit.englishLetter, /Municipal Water Board/);
  assert.match(kit.regionalLetter, /உரிமை/);
  assert.equal(kit.signatureTableTitle, 'Signatures of Affected Residents (Minimum 5 required)');
  assert.equal(kit.digitalBypass.portalName, STATE_PORTALS['Tamil Nadu'].portalName);
  assert.match(kit.localProxy.proxyUrl, /^proxy\.html\?kit=/);
});
