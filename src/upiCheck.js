'use strict';

/**
 * "Pay-Check": tells an investor whether a UPI ID looks like a SEBI-validated handle.
 *
 * Since 1 Oct 2025 SEBI requires registered investor-facing intermediaries to collect
 * money only through NPCI-issued "@valid" handles, e.g. abc.brk@validhdfc
 * (SEBI PR No. 64/2025). This is a format check only — the final authority is
 * SEBI Check: https://siportal.sebi.gov.in/intermediary/sebi-check
 */

const SEBI_CHECK_URL = 'https://siportal.sebi.gov.in/intermediary/sebi-check';

/** Category suffixes published by SEBI/NPCI for validated handles. */
const CATEGORY_SUFFIX = Object.freeze({
  brk: 'Stock broker',
  mf: 'Mutual fund',
  ia: 'Investment adviser',
  ra: 'Research analyst',
  pms: 'Portfolio manager',
  aif: 'Alternative investment fund',
  cra: 'Credit rating agency',
  ofs: 'Offer for sale',
});

const UPI_SHAPE = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/;
const VALID_HANDLE = /^([a-z0-9._-]+)\.([a-z]+)@valid([a-z]+)$/;
const PERSONAL_HINT = /^(\d{10}|[a-z]+\d{2,})@|@(ybl|okaxis|oksbi|okhdfcbank|okicici|paytm|ptyes|ptsbi|axl|ibl|apl)$/;

/**
 * @param {string} raw UPI ID typed or pasted by the user.
 * @returns {{input: string, verdict: 'invalid'|'validated-format'|'not-validated', category?: string,
 *   bank?: string, message: string, advice: string, sebiCheckUrl: string}}
 */
function checkUpi(raw) {
  const input = String(raw ?? '').trim().toLowerCase();
  const base = { input, sebiCheckUrl: SEBI_CHECK_URL };

  if (!UPI_SHAPE.test(input)) {
    return {
      ...base,
      verdict: 'invalid',
      message: 'This is not a valid UPI ID.',
      advice: 'A UPI ID looks like name@bank. Ask the payee to share it again in writing.',
    };
  }

  const m = input.match(VALID_HANDLE);
  if (m && CATEGORY_SUFFIX[m[2]]) {
    return {
      ...base,
      verdict: 'validated-format',
      category: CATEGORY_SUFFIX[m[2]],
      bank: m[3].toUpperCase(),
      message: `Format matches a SEBI-validated handle for a ${CATEGORY_SUFFIX[m[2]]}.`,
      advice:
        'Good sign. Still confirm the entity name on SEBI Check and in your UPI app (look for the green triangle thumbs-up) before paying.',
    };
  }

  const personal = PERSONAL_HINT.test(input);
  return {
    ...base,
    verdict: 'not-validated',
    message: personal
      ? 'This looks like a PERSONAL UPI ID, not a SEBI-registered broker or adviser.'
      : 'This is NOT a SEBI "@valid" handle.',
    advice:
      'SEBI-registered brokers, advisers and mutual funds collect investment money only through "@valid" UPI IDs. ' +
      'Do not pay for stock tips, IPO allotment or "trading account" deposits to this ID.',
  };
}

module.exports = { checkUpi, SEBI_CHECK_URL, CATEGORY_SUFFIX };
