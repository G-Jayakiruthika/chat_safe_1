/**
 * Front-end-only demo backend for TrueSafe.
 * Provides client-side Gemini heuristic analysis, PII redaction,
 * Urimai civic grievance drafting, radar threat feeds, civic feeds, and video feeds.
 */

const KEY = 'truesafe:demo';

export const read = () => {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (data.authed === undefined) {
      data.authed = true; // Default to authed for instant hackathon demo access
    }
    return data;
  } catch {
    return { authed: true };
  }
};

export const write = (d) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* private browsing */
  }
};

/** PII redaction */
export function redactPII(s) {
  return String(s || '')
    .replace(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, '[REDACTED_AADHAAR]')
    .replace(/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, '[REDACTED_PHONE]')
    .replace(/\b\d{9,18}\b/g, '[REDACTED_ACCOUNT]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[REDACTED_PAN]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[REDACTED_EMAIL]')
    .replace(/\b[\w.-]+@[a-z]{2,}\b/gi, '[REDACTED_UPI]')
    .replace(/\b\d{4,6}\b(?=.*\botp\b)|(?<=\botp\b\D{0,12})\d{4,8}/gi, '[REDACTED_OTP]');
}

/** The eight scam families */
export const TYPES = [
  { type: 'Digital arrest', re: /\b(cbi|police|arrest|warrant|narcotics|customs officer|video call|cyber cell|court|supremecourt|trai)\b/i, tactic: 'Authority + fear' },
  { type: 'KYC/OTP', re: /\b(kyc|otp|aadhaar|pan card|re-?kyc|account.{0,12}block|verify.{0,12}(account|card)|net ?banking|sim card block)\b/i, tactic: 'Urgency + authority' },
  { type: 'Fake investment', re: /\b(invest|trading|stock tips|guaranteed|profit|double|crypto|ipo|vip group|returns|fund manager)\b/i, tactic: 'Greed + false scarcity' },
  { type: 'Courier parcel', re: /\b(courier|parcel|fedex|dtdc|customs duty|package|shipment.{0,12}hold|illegal goods)\b/i, tactic: 'Fear + fake authority' },
  { type: 'Task job', re: /\b(task|work from home|part.?time|like.{0,10}video|rating job|telegram job|prepaid task|review job)\b/i, tactic: 'Small win then a deposit' },
  { type: 'Lottery/bill', re: /\b(lottery|lucky draw|prize|winner|kbc|processing fee|electricity.{0,16}disconnect|bill.{0,12}due|power cut)\b/i, tactic: 'Greed or shock' },
  { type: 'Voice clone', re: /\b(new number|phone (broke|lost)|this is (amma|appa|mummy|papa|son|daughter)|urgent.{0,16}(money|transfer)|emergency|accident)\b/i, tactic: 'Impersonating family' },
  { type: 'Loan/sextortion', re: /\b(loan|pre.?approved|apk|install.{0,12}app|screen share|anydesk|nude|video.{0,10}leak|blackmail)\b/i, tactic: 'Shame or desperation' },
];

const PRESSURE = /\b(urgent|immediately|right now|within \d+ (minutes|hours)|today only|last chance|do not tell|don'?t tell|keep this confidential|final notice|act now|tonight at \d+|within 2 hours)\b/i;
const ASK = /\b(otp|pin|cvv|password|upi|pay|transfer|deposit|send money|fee|click|link|install|scan.{0,10}qr|download|apk)\b/i;
const CIVIC = /\b(water|pipe|panchayat|pothole|road|garbage|street ?light|sewage|drain|ration|ration shop|electricity pole|bus|toilet|health center|ward|sanitation|drinking water|street lamp|culvert)\b/i;

const ADVICE = {
  en: {
    scam: 'Do not click links, do not reply, and NEVER share an OTP or PIN. If money has been debited, call 1930 immediately within 24 hours.',
    safe: 'Nothing here matches a known scam pattern. Always stay cautious when interacting with unknown callers or links.',
    civic: 'Urimai civic petition drafted. You can download the physical petition or submit digitally via CM Helpline / Mudhalvarin Mugavari.',
  },
  ta: {
    scam: 'எந்த இணைப்பையும் திறக்க வேண்டாம், பதில் தர வேண்டாம், OTP அல்லது கடவுச்சொல்லை பகிர வேண்டாம். பணம் இழந்திருந்தால் உடனடியாக 1930 எண்ணை அழைக்கவும்.',
    safe: 'அறியப்பட்ட மோசடி அறிகுறிகள் எதுவும் இல்லை. தெரியாத நபர்களிடம் எப்போதும் விழிப்புடன் இருங்கள்.',
    civic: 'உரிமை மனு தயார் செய்யப்பட்டுள்ளது. இதனை பதிவிறக்கி பஞ்சாயத்தில் சமர்ப்பிக்கலாம் அல்லது முதலமைச்சரின் முகவரி போர்ட்டலில் ஆன்லைனில் சமர்ப்பிக்கலாம்.',
  },
  hi: {
    scam: 'लिंक न खोलें, जवाब न दें और OTP या PIN कभी साझा न करें। यदि पैसे कट गए हैं, तो तुरंत 1930 पर कॉल करें।',
    safe: 'यहाँ किसी ज्ञात धोखाधड़ी का कोई संकेत नहीं मिला है। सतर्क रहें।',
    civic: 'उरिमै जन शिकायत पत्र तैयार है। इसे डाउनलोड करें या सीएम हेल्पलाइन पोर्टल पर ऑनलाइन दर्ज करें।',
  },
};

const EXPLAIN = {
  en: (type, tactic) => `This appears to be a ${type} fraud attempt. The primary manipulation vector is: ${tactic}. Legitimate institutions never pressure you to transfer funds or share secret OTPs.`,
  ta: (type, tactic) => `இது ஒரு ${type} மோசடி முயற்சி போல் தெரிகிறது. முக்கிய உத்தி: ${tactic}. உண்மையான அரசு அல்லது வங்கி அதிகாரிகள் எப்போதும் ரகசிய OTP கேட்கமாட்டார்கள்.`,
  hi: (type, tactic) => `यह ${type} धोखाधड़ी का प्रयास प्रतीत होता है। मनोवैज्ञानिक दबाव: ${tactic}। कोई भी वास्तविक बैंक या सरकारी अधिकारी कभी भी OTP नहीं मांगते।`,
};

function getDepartment(text) {
  const t = text.toLowerCase();
  if (t.includes('water') || t.includes('pipe') || t.includes('drinking')) return 'Tamil Nadu Water Supply & Drainage Board / Town Panchayat Water Wing';
  if (t.includes('road') || t.includes('pothole') || t.includes('street')) return 'Highways & Rural Works Department / Panchayat Roads Division';
  if (t.includes('light') || t.includes('electricity') || t.includes('pole') || t.includes('power')) return 'TANGEDCO (Electricity Board) & Town Panchayat Electrical Wing';
  if (t.includes('drain') || t.includes('sewage') || t.includes('garbage') || t.includes('sanitation')) return 'Public Health & Sanitation Department / Town Panchayat';
  if (t.includes('ration')) return 'Civil Supplies & Consumer Protection Department';
  return 'Town Panchayat / Municipal Ward Administrative Office';
}

function makeGrievanceLetters(text, dept) {
  const english = `To,
The Executive Officer / Municipal Commissioner,
${dept},
Government of Tamil Nadu.

Subject: Urgent petition regarding civic redressal - [${text.slice(0, 60)}...]
Reference: Under Section 110 of the Tamil Nadu Panchayats Act, 1994 & Citizen Charter

Respected Sir/Madam,

I am submitting this formal grievance on behalf of the affected residents of our locality:

Grievance Details:
"${redactPII(text)}"

This unresolved situation has been persisting and causing grave danger, health hazards, and inconvenience to the elderly, school children, and daily commuters. Despite prior oral notifications, no remedial maintenance has been executed.

Therefore, we urgently request the concerned authorities to inspect the site and complete necessary repairs within 48 hours.

Yours faithfully,
[Applicant Name & Ward Details]
Contact: [Mobile Number]
Date: ${new Date().toLocaleDateString('en-GB')}`;

  const tamil = `பெறுநர்:
செயல் அலுவலர் / ஆணையர் அவர்கள்,
${dept},
தமிழ்நாடு அரசு.

பொருள்: உடனடி மக்கள் நலக் குறைதீர்ப்பு மனு - [${text.slice(0, 50)}...]
பார்வை: தமிழ்நாடு ஊராட்சிகள் சட்டம் 1994, பிரிவு 110 & குடிமக்கள் பட்டயம்

மதிப்பிற்குரிய ஐயா / அம்மா,

எங்கள் பகுதியில் நிலவும் பின்வரும் அவசர பொதுப் பிரச்சினை குறித்து இந்த மனுவைச் சமர்ப்பிக்கிறேன்:

புகார் விபரம்:
"${redactPII(text)}"

இப்பிரச்சினையால் பள்ளி குழந்தைகள், முதியவர்கள் மற்றும் பொதுமக்கள் மிகுந்த சிரமத்திற்கு உள்ளாகியுள்ளனர். எனவே, சம்பந்தப்பட்ட துறை அதிகாரிகள் உடனடியாக நேரில் ஆய்வு செய்து போர்க்கால அடிப்படையில் இதனை சரிசெய்யுமாறு பணிவுடன் வேண்டுகிறோம்.

இவண்,
[மனுதாரர் பெயர் மற்றும் வார்டு எண்]
தொலைபேசி எண்: [மொபைல் எண்]
தேதி: ${new Date().toLocaleDateString('ta-IN')}`;

  return { english, tamil };
}

/**
 * Score a message: detect SCAM vs CIVIC_ISSUE vs SAFE
 */
export function heuristic(text, lang = 'en') {
  const L = ADVICE[lang] ? lang : 'en';
  const hit = TYPES.find((t) => t.re.test(text));
  const pressure = PRESSURE.test(text);
  const asks = ASK.test(text);
  const civic = CIVIC.test(text);

  let risk = 0;
  if (hit) risk += 45;
  if (pressure) risk += 25;
  if (asks) risk += 25;
  if (hit && asks && pressure) risk += 5;
  risk = Math.min(risk, 98);

  // If civic keywords exist and no prominent scam triggers, classify as CIVIC_ISSUE
  if (civic && !hit && !asks) {
    const dept = getDepartment(text);
    const letters = makeGrievanceLetters(text, dept);
    return {
      classification: 'CIVIC_ISSUE',
      riskScore: 6,
      department: dept,
      explanation:
        L === 'ta'
          ? 'இது ஒரு பொது மக்கள் நலம் மற்றும் உள்கட்டமைப்பு குறைதீர்ப்பு மனுவாக கண்டறியப்பட்டுள்ளது.'
          : L === 'hi'
            ? 'यह एक नागरिक शिकायत (सार्वजनिक बुनियादी ढांचा) के रूप में वर्गीकृत किया गया है।'
            : 'Detected as a legitimate civic infrastructure issue requiring municipal action.',
      advice: ADVICE[L].civic,
      redactedText: redactPII(text),
      grievanceLetter: letters.english,
      grievanceLetterTamil: letters.tamil,
      cmHelplineText: `[CM HELPLINE DRAFT]\nDepartment: ${dept}\nIssue: ${text}\nAction Requested: Immediate site inspection and repair within 48 hours. Complainant Ward: Ward 4.`,
      engine: 'gemini-3.8-flash (Simulated Hybrid)',
      lang: L,
    };
  }

  const isScam = Boolean(hit) || (pressure && asks);
  const redacted = redactPII(text);

  if (isScam) {
    const scamType = hit ? hit.type : 'Social engineering';
    const tactic = hit ? hit.tactic : 'Urgency + demand for funds/OTP';
    return {
      classification: 'SCAM',
      riskScore: Math.max(risk, 84),
      scamType,
      tactic,
      explanation: EXPLAIN[L](scamType, tactic),
      advice: ADVICE[L].scam,
      redactedText: redacted,
      cybercrimeDraft:
        'To,\nThe Cyber Crime Police Station / National Cyber Crime Portal (cybercrime.gov.in)\n\n' +
        `Subject: Formal Complaint regarding ${scamType} fraud attempt\n\n` +
        'Respected Sir/Madam,\n\n' +
        'I am reporting a deceptive message/call received by me/my family with intent to defraud:\n\n' +
        `Threat Category: ${scamType}\nTactic Observed: ${tactic}\nIncident Date: ${new Date().toLocaleDateString()}\n\n` +
        `Redacted Message Content:\n"${redacted}"\n\n` +
        'I have not authorized or transferred any money. I request immediate blocking of the perpetrator\'s communication channels and necessary legal investigation.\n\n' +
        'Yours faithfully,\n[Name]\n[Contact Phone: REDACTED]\nTrueSafe Verified Report ID: TS-' + Math.floor(100000 + Math.random() * 900000),
      engine: 'gemini-3.8-flash (Simulated Hybrid)',
      lang: L,
    };
  }

  return {
    classification: 'SAFE',
    riskScore: Math.min(risk, 18),
    explanation:
      L === 'ta'
        ? 'அறியப்பட்ட மோசடி அல்லது அச்சுறுத்தல் வடிவங்கள் எதுவும் காணப்படவில்லை. பாதுகாப்பானது.'
        : L === 'hi'
          ? 'कोई ज्ञात धोखाधड़ी या धमकी पैटर्न नहीं मिला है। सुरक्षित प्रतीत होता है।'
          : 'No malicious indicators or extortion patterns detected. Message appears genuine.',
    advice: ADVICE[L].safe,
    redactedText: redacted,
    engine: 'gemini-3.8-flash (Simulated Hybrid)',
    lang: L,
  };
}

/** Default Urimai Action Kit representing the father's keypad phone speed-dial 9 call */
export const DEFAULT_ACTION_KIT = {
  id: 'kit_father_water_pipe_01',
  timestamp: new Date().toISOString(),
  caller: 'Father (Appa)',
  callerPhone: '+91 94432 [REDACTED]',
  device: 'Nokia 105 Keypad Feature Phone',
  location: 'South Mada Street, Thiruvannamalai Town Panchayat, Tamil Nadu',
  department: 'Town Panchayat & TWAD (Water Supply Board)',
  voiceTranscript: 'Vanakkam pa. Enga theruvula main panchayat kudineer kuzhai udanju 3 naal aachu. Thanni muzhukka saakadaila veena poguthu, yarume vandhu paakkala. Oorla kudi thaanikku romba kashtama irukku pa.',
  voiceTranscriptEnglish: 'Hello son. The main panchayat drinking water pipe on our street broke 3 days ago. Clean water is flowing into open drains and no one has come to repair it. The villagers are struggling for drinking water.',
  voiceAudioDuration: '0:14',
  summary: 'Panchayat drinking water pipeline fractured on South Mada Street; severe water wastage and public scarcity for 3 consecutive days.',
  status: 'Draft Ready',
  photoUrl: null,
  photoAttached: false,
  grievanceLetter: `To,
The Executive Officer,
Town Panchayat Administration & Rural Water Supply Wing,
Thiruvannamalai District, Tamil Nadu.

Subject: Urgent petition regarding broken drinking water pipeline on South Mada Street - Ward 4
Reference: Tamil Nadu Panchayats Act, 1994, Sec. 110 (Obligatory duties on drinking water provision)

Respected Sir/Madam,

I am writing on behalf of the senior citizens and families of South Mada Street, Ward 4. The primary overhead supply distribution pipe broke 3 days ago near the primary school junction.

Potable drinking water has been gushing into the road drainage, leading to severe public water shortage and contamination risks. Despite verbal alerts to the local pump operator, no maintenance action has been taken.

We kindly request immediate deployment of the emergency pipeline repair crew to restore water supply.

Yours faithfully,
Affected Residents of South Mada Street
Date: ${new Date().toLocaleDateString('en-GB')}`,
  grievanceLetterTamil: `பெறுநர்:
செயல் அலுவலர் அவர்கள்,
பேரூராட்சி நிர்வாகம் மற்றும் குடிநீர் வழங்கல் பிரிவு,
திருவண்ணாமலை மாவட்டம், தமிழ்நாடு.

பொருள்: தெற்கு மாட வீதி வார்டு 4-ல் உடைந்த குடிநீர் குழாயை போர்க்கால அடிப்படையில் சீரமைக்கக் கோருதல்.
பார்வை: தமிழ்நாடு ஊராட்சிகள் சட்டம் 1994, பிரிவு 110 (பொதுக் குடிநீர் விநியோகம்)

மதிப்பிற்குரிய ஐயா / அம்மா,

எங்கள் தெற்கு மாட வீதி பகுதியில் செல்லும் பஞ்சாயத்து பிரதான குடிநீர் குழாய் உடைந்து கடந்த 3 நாட்களாக குடிநீர் வீணாக சாக்கடையில் கலந்து கொண்டிருக்கிறது. இதனால் எங்கள் பகுதி முதியவர்கள், பொதுமக்கள் குடிக்க தண்ணீர் இன்றி தவித்து வருகிறோம்.

உடனடியாக களப் பணியாளர்களை அனுப்பி உடைந்த குடிநீர் குழாயை சீரமைத்து சுத்தமான குடிநீர் வழங்கிட பணிவுடன் வேண்டுகிறோம்.

இவண்,
தெற்கு மாட வீதி பொதுமக்கள்
தேதி: ${new Date().toLocaleDateString('ta-IN')}`,
  cmHelplineText: `[TN CM HELPLINE 1100 / MUDHALVARIN MUGAVARI]\nDistrict: Thiruvannamalai\nTaluk/Block: Town Panchayat Ward 4\nSubject: Broken Drinking Water Supply Pipe on South Mada Street\nDetails: Panchayat water pipe damaged for 3 days. Clean water gushing into drainage. 60+ households without water.\nAction Required: Immediate TWAD/Panchayat repair within 24 hours.`,
};

/** Radar Live Threat Feed */
export const RADAR_FEED = [
  { id: 1, type: 'Digital Arrest', area: 'Coimbatore', text: 'Scammer pretending to be CBI Officer Rajesh Sharma 98401 23456 threatening victim with arrest over fake FedEx narcotics parcel.', hits: 342, severity: 'CRITICAL', time: '12m ago' },
  { id: 2, type: 'TNEB Power Cut SMS', area: 'Chennai', text: 'SMS from 919876543210 claiming: "Dear consumer, electricity will be disconnected tonight at 9:30 PM due to unpaid bill. Update bill via APK link bit.ly/tneb-bill".', hits: 289, severity: 'HIGH', time: '24m ago' },
  { id: 3, type: 'Bank KYC Expiry', area: 'Madurai', text: 'Message targeting SBI users: "Your YONO account is blocked today. Click sbi-kyc-verify.in and enter your PAN [ABCDE1234F] and OTP [491023]".', hits: 215, severity: 'HIGH', time: '45m ago' },
  { id: 4, type: 'YouTube Like Task Job', area: 'Trichy', text: 'WhatsApp message offering ₹5,000/day for liking videos. Telegram channel asks ₹3,000 security deposit for premium VIP task.', hits: 178, severity: 'MEDIUM', time: '1h ago' },
  { id: 5, type: 'AI Voice Clone Emergency', area: 'Salem', text: 'Caller cloned son\'s voice claiming accident in Bangalore, pleaded for ₹25,000 emergency UPI transfer to stranger account.', hits: 96, severity: 'CRITICAL', time: '2h ago' },
];

/** Radar Civic Watch Stream */
export const CIVIC_FEED = [
  { id: 101, department: 'Water Supply', area: 'Thiruvannamalai - Ward 4', title: 'Main drinking water pipeline fracture on South Mada St', status: 'Drafted via Button Phone (Speed-Dial 9)', reports: 14, time: '18m ago' },
  { id: 102, department: 'Sanitation', area: 'Madurai - Melur Panchayat', title: 'Overflowing open garbage collection bin near primary school', status: 'Petition Submitted to EO', reports: 23, time: '1h ago' },
  { id: 103, department: 'Electricity (TANGEDCO)', area: 'Coimbatore - Pollachi Road', title: 'Low-hanging live wire near bus shelter posing pedestrian risk', status: 'Pending Official Inspection', reports: 31, time: '3h ago' },
  { id: 104, department: 'Roads & Highways', area: 'Salem - Omalur Junction', title: '3-foot deep pothole caused by heavy rain causing motorcycle falls', status: 'Signatures Collected (8 residents)', reports: 19, time: '5h ago' },
];

/** Verified Scam News Videos / Reels Feed */
export const VIDEO_FEED = [
  {
    id: 'vid-1',
    title: '⚠️ Beware: "TNEB Power Cut at 9:30 PM" WhatsApp SMS Scam Exposed',
    category: 'Electricity Scam',
    creator: 'TrueSafe Cyber Cell (Verified)',
    views: '124K views',
    duration: '0:45',
    verified: true,
    summary: 'TNEB never sends SMS threatening disconnection within hours or asking you to call personal mobile numbers. Always pay only via official TANGEDCO app or web portal.',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    tags: ['#TNEB', '#CyberSafety', '#SMSScam'],
  },
  {
    id: 'vid-2',
    title: '🚨 Digital Arrest Scam: How Scammers Impersonate CBI & Supreme Court',
    category: 'Digital Arrest',
    creator: 'Cyber Crime Volunteer Network',
    views: '89K views',
    duration: '0:58',
    verified: true,
    summary: 'No law enforcement agency in India conducts arrests or interrogations via Skype/WhatsApp video calls. Hang up immediately and dial 1930.',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
    tags: ['#DigitalArrest', '#1930', '#LegalSafety'],
  },
  {
    id: 'vid-3',
    title: '💡 Voice Cloning AI: How Hackers Mimic Your Child\'s Voice in Tamil',
    category: 'AI Voice Cloning',
    creator: 'TechSafe Tamil Nadu',
    views: '67K views',
    duration: '0:52',
    verified: true,
    summary: 'Scammers take 3 seconds of audio from social media to clone voices. Establish a secret "Family Safe Word" to verify true emergencies.',
    videoSrc: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    poster: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80',
    tags: ['#AIVoice', '#FamilyProtection', '#Deepfake'],
  },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const demoApi = {
  async me() {
    if (!read().authed) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    return { ok: true };
  },
  async login(_phone, otp) {
    await wait(250);
    if (otp !== '1234') throw Object.assign(new Error('Invalid code'), { status: 401 });
    write({ ...read(), authed: true });
    return { ok: true };
  },
  async logout() {
    write({ ...read(), authed: false });
    return { ok: true };
  },
  async analyze(text, lang) {
    await wait(350);
    const out = heuristic(text, lang);
    const d = read();
    const items = [{ id: Date.now(), ...out, createdAt: new Date().toISOString() }, ...(d.history || [])].slice(0, 50);
    write({ ...d, history: items });
    return out;
  },
  async radar() {
    await wait(180);
    return {
      items: RADAR_FEED.map((i) => ({ ...i, text: redactPII(i.text), rawText: i.text })),
      civic: CIVIC_FEED,
      videos: VIDEO_FEED,
    };
  },
  async history() {
    return { items: read().history || [] };
  },
  async upload(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file?.type || '')) {
      throw Object.assign(new Error('Only JPEG/PNG images up to 4MB are allowed'), { status: 400 });
    }
    return { ok: true, bytes: file.size };
  },
  async deleteMyData() {
    write({});
    return { ok: true };
  },
};

export const isDemo =
  import.meta.env.VITE_DEMO === '1' ||
  (typeof window !== 'undefined' && (
    window.location.hostname.includes('github.io') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    !import.meta.env.VITE_API_URL
  ));
export const DEMO = isDemo;
