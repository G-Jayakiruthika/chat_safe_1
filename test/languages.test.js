'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LANGUAGES, detectLanguage } = require('../src/languages');

test('supports all 23 Indian languages (English + 22 Eighth Schedule) with greetings', () => {
  assert.equal(LANGUAGES.length, 23);
  for (const l of LANGUAGES) {
    assert.ok(l.code && l.name && l.native && l.speech && l.greeting);
  }
});

test('detectLanguage identifies Indian scripts accurately', () => {
  assert.equal(detectLanguage('வணக்கம் தண்ணீர் குழாய் உடைந்துள்ளது'), 'ta');
  assert.equal(detectLanguage('पानी का पाइप टूट गया है'), 'hi');
  assert.equal(detectLanguage('నీటి పైపు పగిలిపోయింది'), 'te');
  assert.equal(detectLanguage('ನೀರಿನ ಪೈಪ್ ಒಡೆದಿದೆ'), 'kn');
  assert.equal(detectLanguage('വെള്ളത്തിന്റെ പൈപ്പ് പൊട്ടി'), 'ml');
  assert.equal(detectLanguage('পানির পাইপ ভেঙে গেছে'), 'bn');
});
