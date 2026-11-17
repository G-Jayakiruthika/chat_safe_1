'use strict';

const { localized, safeLang } = require('./content');

/**
 * Autopilot turns one verdict into the finished work.
 *
 * Scanning a message only tells you that something is wrong. Everything after that
 * — writing a refusal that does not provoke the caller, filling in a cybercrime
 * complaint, warning the rest of the family, reporting the number — is the part
 * people actually skip, because each piece is a small chore. Autopilot writes all of
 * them from the analysis, marks which ones Chat_Safe can carry out by itself when a
 * chat app is connected, and leaves the rest one tap from done.
 */

/** Safe refusals, written to end the conversation without arguing with the caller. */
const REFUSAL = Object.freeze({
  en: 'I do not share OTP, bank or ID details on chat or calls. I am checking this with the bank and the police directly. Please do not contact me again.',
  hi: 'मैं चैट या कॉल पर OTP, बैंक या पहचान की जानकारी साझा नहीं करता/करती। मैं इसकी जांच सीधे बैंक और पुलिस से कर रहा/रही हूँ। कृपया दोबारा संपर्क न करें।',
  ta: 'OTP, வங்கி அல்லது அடையாள விவரங்களை நான் அரட்டையிலோ அழைப்பிலோ பகிர மாட்டேன். இதை நேரடியாக வங்கியிடமும் காவல்துறையிடமும் சரிபார்க்கிறேன். மீண்டும் தொடர்பு கொள்ள வேண்டாம்.',
});

/** A one-line warning the user can forward to family, worded for a group chat. */
const WARN = Object.freeze({
  en: (type) => `Careful — I just got a ${type} message. It is a scam. Do not reply, do not pay, do not share any OTP. Forward anything like this to me first.`,
  hi: (type) => `सावधान — मुझे अभी ${type} से जुड़ा संदेश मिला। यह धोखाधड़ी है। जवाब न दें, पैसे न भेजें, OTP साझा न करें। ऐसा कुछ आए तो पहले मुझे भेजें।`,
  ta: (type) => `கவனம் — எனக்கு இப்போது ${type} தொடர்பான செய்தி வந்தது. இது மோசடி. பதில் அளிக்க வேண்டாம், பணம் அனுப்ப வேண்டாம், OTP பகிர வேண்டாம். இதுபோல் வந்தால் முதலில் எனக்கு அனுப்புங்கள்.`,
});

/** Where a message of each kind gets reported. */
const REPORT_ROUTE = Object.freeze({
  call: { label: 'Report the number on Sanchar Saathi (Chakshu)', url: 'https://sancharsaathi.gov.in' },
  money: { label: 'Call 1930 within 24 hours to freeze the transfer', url: 'tel:1930' },
  portal: { label: 'File the full complaint on the national portal', url: 'https://cybercrime.gov.in' },
});

const TITLES = Object.freeze({
  en: {
    stop: 'Stop here', reply: 'Send this reply', complaint: 'File the complaint',
    report: 'Report the sender', warn: 'Warn your family', block: 'Block and delete', watch: 'Keep watching',
  },
  hi: {
    stop: 'यहीं रुकें', reply: 'यह जवाब भेजें', complaint: 'शिकायत दर्ज करें',
    report: 'भेजने वाले की शिकायत करें', warn: 'परिवार को सचेत करें', block: 'ब्लॉक करके हटाएँ', watch: 'नज़र रखें',
  },
  ta: {
    stop: 'இங்கேயே நிறுத்துங்கள்', reply: 'இந்தப் பதிலை அனுப்புங்கள்', complaint: 'புகார் பதிவு செய்யுங்கள்',
    report: 'அனுப்பியவரைப் புகார் செய்யுங்கள்', warn: 'குடும்பத்தை எச்சரியுங்கள்', block: 'தடுத்து நீக்குங்கள்', watch: 'கவனியுங்கள்',
  },
});

/**
 * @param {object} analysis a result from engine.analyze
 * @param {{lang?: string, connected?: string[], autoActions?: string[]}} [opts]
 *   connected: chat apps the user has linked, which is what makes a step automatic.
 *   autoActions: the step ids the user has switched on in their automation settings.
 * @returns {{steps: object[], autoCount: number, headline: string}}
 */
function buildPlan(analysis, opts = {}) {
  const lang = safeLang(opts.lang || analysis.lang || 'en');
  const t = localized(TITLES, lang);
  const connected = Array.isArray(opts.connected) ? opts.connected : [];
  const on = new Set(Array.isArray(opts.autoActions) ? opts.autoActions : []);
  const money = analysis.indicators?.amounts?.length || analysis.indicators?.upiIds?.length;
  const steps = [];

  const add = (id, extra) => {
    // A step runs by itself only when the user asked for it AND a channel exists to act on.
    const canAuto = Boolean(extra.automatable) && connected.length > 0 && on.has(id);
    steps.push({ id, title: t[id], auto: canAuto, ...extra });
  };

  if (analysis.score >= 30) {
    add('stop', {
      tone: 'danger',
      why: 'No bank, police or courier ever asks for OTP, remote access or money on a call.',
      automatable: false,
    });
    add('reply', {
      tone: 'action',
      why: 'A flat refusal ends the conversation without arguing or revealing anything.',
      text: localized(REFUSAL, lang),
      automatable: true,
    });
    if (analysis.complaint) {
      add('complaint', {
        tone: 'action',
        why: 'Every detail Chat_Safe found is already filled in — copy it into the portal.',
        text: analysis.complaint,
        links: [REPORT_ROUTE.portal, ...(money ? [REPORT_ROUTE.money] : [])],
        automatable: false,
      });
    }
    add('report', {
      tone: 'action',
      why: 'Reporting the number takes it out of circulation for everyone else.',
      links: [REPORT_ROUTE.call],
      automatable: true,
    });
    add('warn', {
      tone: 'action',
      why: 'The same message usually reaches the rest of a family within days.',
      text: localized(WARN, lang)(analysis.scamType || 'scam'),
      automatable: true,
    });
    add('block', { tone: 'calm', why: 'Block first, then delete, so the thread cannot be revived.', automatable: true });
  } else {
    add('watch', {
      tone: 'calm',
      why: 'Nothing dangerous found. Send anything that asks for money, OTP or an app install.',
      automatable: false,
    });
  }

  const autoCount = steps.filter((s) => s.auto).length;
  return { steps, autoCount, headline: analysis.verdict };
}

module.exports = { buildPlan, REFUSAL, WARN };
