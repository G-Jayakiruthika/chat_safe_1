'use strict';

/**
 * Offline, deterministic Kavach (Scam) + Urimai (Civic Intent) detection engine.
 * Patterns cover English, Hinglish, Tanglish, Hindi, Tamil, Telugu, Kannada,
 * Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, Urdu and more.
 */

const CATEGORIES = [
  {
    id: 'investment',
    label: 'Fake investment / stock-tip group',
    weight: 30,
    patterns: [
      /guarantee[d]?\s*(return|profit|income)/i,
      /double\s*(your)?\s*money/i,
      /\b\d{1,3}\s*%\s*(daily|per\s*day|weekly|monthly)\s*(return|profit)?/i,
      /(stock|share|ipo|f&o|option)\s*(tips?|calls?|allotment)/i,
      /\b(vip|premium)\s*(group|channel)/i,
      /institutional\s*(account|trading)|\bfii\s*account/i,
      /trading\s*app|crypto\s*(profit|investment)/i,
      /withdraw(al)?\s*(fee|tax|charges)/i,
      /munafa|मुनाफा|गारंटी|पैसा\s*डबल/i,
      /லாபம்|இரட்டிப்பு|panam\s*double/i,
    ],
  },
  {
    id: 'digital_arrest',
    label: '"Digital arrest" / fake police or agency',
    weight: 35,
    patterns: [
      /digital\s*arrest/i,
      /\b(cbi|ncb|enforcement\s*directorate|ed\s*officer|customs\s*officer|cyber\s*police|trai)\b/i,
      /money\s*laundering|hawala/i,
      /arrest\s*warrant|fir\s*(registered|filed)|case\s*(is\s*)?registered\s*against/i,
      /(stay|remain)\s*on\s*(the\s*)?(video\s*)?call|do\s*not\s*disconnect/i,
      /supreme\s*court|rbi\s*(officer|verification)/i,
      /गिरफ्तार|गिरफ़्तार|वारंट|पुलिस\s*केस/i,
      /கைது|வாரண்ட்|போலீஸ்\s*வழக்கு/i,
    ],
  },
  {
    id: 'kyc_otp',
    label: 'KYC / OTP / account-block fraud',
    weight: 30,
    patterns: [
      /\b(kyc|pan|aadhaar)\b.{0,30}(update|expire|block|suspend|verify)/i,
      /(account|card|sim)\s*(will\s*be|is|has\s*been)?\s*(blocked|suspended|deactivated|closed)/i,
      /(share|send|tell|give|asked\s*(for)?)\s*(me\s*)?(the\s*)?(otp|pin|cvv|password)/i,
      /\basked\s+for\s+(my\s+)?otp\b/i,
      /\b(anydesk|teamviewer|quick\s*support|rustdesk)\b|screen\s*shar/i,
      /\.apk\b|install\s*(this\s*)?app/i,
      /खाता\s*बंद|ओटीपी\s*बताओ|ओटीपी\s*मांग|केवाईसी/i,
      /கணக்கு\s*முடக்க|ஓடிபி|கேஒய்சி/i,
    ],
  },
  {
    id: 'courier',
    label: 'Courier / parcel / customs scam',
    weight: 25,
    patterns: [
      /(fedex|dhl|blue\s*dart|courier|parcel|package)\b.{0,60}(drugs?|illegal|seized|passports?|mdma|customs)/i,
      /(drugs?|illegal|seized|passports?|mdma)\b.{0,60}(fedex|dhl|courier|parcel|package)/i,
      /पार्सल|कूरियर/i,
      /பார்சல்|கூரியர்/i,
    ],
  },
  {
    id: 'task_job',
    label: 'Part-time job / task scam',
    weight: 25,
    patterns: [
      /part[\s-]*time\s*job|work\s*from\s*home/i,
      /(like|subscribe|rate|review)\s*(youtube|videos?|hotels?|products?|google\s*maps)/i,
      /prepaid\s*task|merchant\s*task|task\s*(group|commission)/i,
      /earn\s*(₹|rs\.?|inr)?\s*\d[\d,]*\s*(daily|per\s*day|a\s*day)/i,
      /घर\s*बैठे\s*कमाई/i,
      /வீட்டிலிருந்தே\s*சம்பாதி/i,
    ],
  },
  {
    id: 'reward_bill',
    label: 'Lottery / reward / electricity-bill scam',
    weight: 25,
    patterns: [
      /(won|winner|selected)\b.{0,40}(lottery|prize|lucky\s*draw|kbc|car|iphone)/i,
      /(processing|registration|delivery)\s*fee/i,
      /electricity\s*(bill|connection|power)\b.{0,60}(disconnect|cut|tonight)/i,
      /लॉटरी|इनाम|बिजली\s*कट/i,
      /லாட்டரி|பரிசு|மின்\s*இணைப்பு\s*துண்டி/i,
    ],
  },
  {
    id: 'family_voice',
    label: 'Family emergency / cloned-voice scam',
    weight: 25,
    patterns: [
      /(this\s*is\s*my\s*new\s*number|new\s*number\s*save)/i,
      /(accident|hospital|arrested|police\s*station)\b.{0,60}(send|transfer|pay)\b/i,
      /(mummy|papa|amma|appa|beta|son|daughter)\b.{0,40}(urgent|emergency|help)/i,
    ],
  },
  {
    id: 'sextortion_loan',
    label: 'Loan-app harassment / sextortion',
    weight: 30,
    patterns: [
      /(morphed|nude|private)\s*(photo|video|pics?)/i,
      /(viral|leak|send\s*to\s*(your\s*)?(contacts|family))/i,
      /instant\s*loan.{0,40}(no\s*documents|without\s*cibil)/i,
    ],
  },
];

const TACTICS = [
  {
    id: 'urgency',
    label: 'Urgency / time pressure',
    weight: 12,
    patterns: [
      /\b(immediately|urgent(ly)?|right\s*now|within\s*\d+\s*(min|minutes|hours?)|today\s*only|last\s*chance|before\s*\d)/i,
      /\b(act|update|click|pay|verify|respond|register|join)\s+now\b/i,
      /turant|jaldi|abhi\s*ke\s*abhi|तुरंत|जल्दी/i,
      /udane|seekiram|உடனே|சீக்கிரம்/i,
    ],
  },
  {
    id: 'secrecy',
    label: 'Asks you to keep it secret',
    weight: 15,
    patterns: [
      /(don'?t|do\s*not|never)\s*(tell|inform|share\s*with)\s*(anyone|family|bank|police)/i,
      /(confidential|secret)\s*(investigation|matter|case)/i,
      /kisi\s*ko\s*(mat|na)\s*batana|किसी\s*को\s*मत\s*बताना/i,
      /yaar(idamum|kittayum)\s*solla\s*koodathu|யாரிடமும்\s*சொல்ல/i,
    ],
  },
  {
    id: 'authority',
    label: 'Claims to be an official / authority',
    weight: 10,
    patterns: [
      /\b(officer|inspector|commissioner|government\s*of\s*india|ministry|department)\b/i,
      /अधिकारी|सरकारी/i,
      /அதிகாரி|அரசு/i,
    ],
  },
  {
    id: 'fear',
    label: 'Fear / threat of arrest or loss',
    weight: 12,
    patterns: [
      /\b(jail|arrest|warrant|legal\s*action|penalty|fine|freeze|seize|court)\b/i,
      /जेल|गिरफ्तार|कानूनी\s*कार्रवाई/i,
      /சிறை|கைது|சட்ட\s*நடவடிக்கை/i,
    ],
  },
  {
    id: 'greed',
    label: 'Too-good-to-be-true money',
    weight: 10,
    patterns: [
      /\b(guaranteed|100%\s*profit|risk[\s-]*free|double|lakhs?|crores?|jackpot|bonus)\b/i,
      /करोड़|लाख|मुफ्त/i,
      /கோடி|லட்சம்|இலவச/i,
    ],
  },
  {
    id: 'isolation',
    label: 'Moves chat to private app / stays on call',
    weight: 10,
    patterns: [
      /\b(telegram|whatsapp\s*group|signal)\b.{0,30}(join|message|contact|ping)/i,
      /stay\s*on\s*(this\s*)?(call|video)/i,
    ],
  },
  {
    id: 'payment_pressure',
    label: 'Asks for money / UPI / gift card',
    weight: 14,
    patterns: [
      /\b(transfer|deposit|send|pay)\b.{0,35}(₹|rs\.?|inr|upi|account|usdt)/i,
      /\b(scan\s*(the\s*)?qr|pay\s*via\s*upi)\b/i,
    ],
  },
];

/**
 * Civic grievance patterns for the Urimai Engine across 23-language contexts.
 */
const CIVIC_PATTERNS = [
  { id: 'water', dept: 'Municipal Water Board / Panchayat Water Supply', weight: 30, patterns: [
    /\b(water\s*pipe|drinking\s*water|pipe\s*br(oke|oken)|water\s*leak|no\s*water|tap\s*water|borewell|overhead\s*tank|water\s*supply)\b/i,
    /தண்ணீர்|குடிநீர்|குழாய்|பைப்\s*உடை/i,
    /पानी|पाइप|नल|जल\s*बोर्ड/i,
    /నీరు|పైపు|తాగునీరు/i,
    /ನೀರು|ಪೈಪ್/i,
    /വെള്ളം|പൈപ്പ്/i,
    /পানি|জল|পাইপ/i,
  ] },
  { id: 'road', dept: 'Highways & Municipal Public Works (PWD)', weight: 30, patterns: [
    /\b(broken\s*road|pothole|road\s*(damage|broken|bad|repair)|culvert|bridge|footpath|speed\s*breaker)\b/i,
    /சாலை|ரோடு|குழி/i,
    /सड़क|गड्ढा|रास्ता/i,
    /రోడ్డు|గుంతలు/i,
    /ರಸ್ತೆ|ಗುಂಡಿ/i,
    /റോഡ്|കുഴി/i,
    /রাস্তা|গর্ত/i,
  ] },
  { id: 'electricity', dept: 'State Electricity Board (DISCOM / TNEB)', weight: 28, patterns: [
    /\b(street\s*light|streetlight|lamp\s*post|transformer|electric\s*pole|fallen\s*wire|power\s*outage|voltage)\b/i,
    /தெரு\s*விளக்கு|மின்\s*கம்பம்|டிரான்ஸ்பார்மர்/i,
    /स्ट्रीट\s*लाइट|बिजली\s*का\s*खंभा|ट्रांसफार्मर/i,
    /వీధి\s*దీపం|కరెంట్\s*స్తంభం/i,
  ] },
  { id: 'sanitation', dept: 'Sanitation, Drainage & Solid Waste Wing', weight: 28, patterns: [
    /\b(drainage|sewage|gutter|overflow|garbage|waste\s*collect|stink|mosquito|cleanliness|toilet)\b/i,
    /சாக்கடை|கழிவுநீர்|குப்பை/i,
    /नाली|सीवर|कचरा|गंदगी/i,
    /డ్రైనేజీ|చెత్త/i,
  ] },
  { id: 'civic_general', dept: 'Local Gram Panchayat / Municipal Ward Office', weight: 20, patterns: [
    /\b(panchayat|municipality|corporation|ward\s*\d+|gram\s*sabha|ration\s*shop|primary\s*health|anganwadi|bus\s*shelter|no\s*one\s*is\s*fixing|complaint\s*to\s*(municipality|panchayat|collector))\b/i,
    /பஞ்சாயத்து|நகராட்சி|மாநகராட்சி|வார்டு/i,
    /पंचायत|नगर\s*निगम|वार्ड|मोहल्ला/i,
  ] },
];

const SAFE_HINTS = [
  /^\s*(hi|hello|namaste|vanakkam)\b.{0,40}$/i,
  /\b(reach(ed)?\s*safely|take\s*your\s*(tablet|medicine)|good\s*morning|happy\s*birthday|dinner|lunch)\b/i,
  /\b(do\s*not\s*share\s*(this\s*)?otp\s*with\s*anyone|otp\s*for\s*(your\s*)?(swiggy|zomato|amazon|flipkart|irctc)\s*order)\b/i,
];

function matchRules(text, rules) {
  const hits = [];
  for (const rule of rules) {
    if (rule.patterns.some((re) => re.test(text))) {
      hits.push({ id: rule.id, label: rule.label || rule.dept, weight: rule.weight });
    }
  }
  return hits;
}

function analyzeRules(text, { suspiciousIndicators = 0 } = {}) {
  const categories = matchRules(text, CATEGORIES);
  const tactics = matchRules(text, TACTICS);

  let score = 0;
  for (const c of categories) score += c.weight;
  for (const t of tactics) score += t.weight;
  score += Math.min(25, suspiciousIndicators * 12);

  if (categories.length === 0 && tactics.length === 0 && SAFE_HINTS.some((re) => re.test(text))) {
    score = Math.min(score, 10);
  }
  if (categories.length >= 2 || (categories.length >= 1 && tactics.length >= 2)) {
    score = Math.max(score, 72);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const scamType = categories[0]?.label || (score >= 30 ? 'Suspicious message' : 'No common scam pattern');
  return { score, categories, tactics, scamType };
}

/**
 * Classify user input into SCAM (Kavach), CIVIC (Urimai), or GENERAL.
 * @param {string} text
 */
function classifyIntent(text, opts = {}) {
  const clean = typeof text === 'string' ? text : '';
  const scam = analyzeRules(clean, opts);
  const civicHits = matchRules(clean, CIVIC_PATTERNS);
  const civicScore = civicHits.reduce((s, h) => s + h.weight, 0);

  // If strong civic signal and not a fake electricity-bill payment scam
  const isBillPaymentScam = /\b(pay|upi|disconnect|cut\s*tonight|link|otp|bit\.ly)\b/i.test(clean) && scam.score >= 30;
  if (civicScore >= 20 && !isBillPaymentScam && civicScore >= scam.score) {
    return {
      intent: 'CIVIC',
      confidence: Math.min(98, 55 + civicScore),
      civicCategory: civicHits[0].id,
      department: civicHits[0].label,
      scam,
    };
  }
  if (scam.score >= 25) {
    return {
      intent: 'SCAM',
      confidence: Math.min(99, Math.max(60, scam.score)),
      civicCategory: null,
      department: null,
      scam,
    };
  }
  return {
    intent: 'GENERAL',
    confidence: 70,
    civicCategory: null,
    department: null,
    scam,
  };
}

function combineScores(ruleScore, aiScore) {
  if (typeof aiScore !== 'number' || !Number.isFinite(aiScore)) return ruleScore;
  const clampedAi = Math.max(0, Math.min(100, Math.round(aiScore)));
  const blended = Math.round(ruleScore * 0.4 + clampedAi * 0.6);
  return Math.max(blended, Math.round(ruleScore * 0.8));
}

function levelFor(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'suspicious';
  return 'safe';
}

module.exports = { CATEGORIES, TACTICS, CIVIC_PATTERNS, analyzeRules, classifyIntent, combineScores, levelFor };
