'use strict';

/**
 * Localised, offline content across all 23 supported Indian languages:
 * verdicts, safety steps, Paati decoy lines, Kavach voice lines, and 1930 complaint drafts.
 */

const { safeLang } = require('./languages');

const OFFLINE_LANGS = Object.freeze([
  'en', 'ta', 'hi', 'te', 'kn', 'ml', 'bn', 'mr', 'gu', 'pa', 'or', 'ur', 'as',
]);

const localized = (table, lang) => table[safeLang(lang)] || table.en;

const VERDICT = Object.freeze({
  en: {
    safe: 'Looks safe. No common scam pattern found — still never share OTPs.',
    suspicious: 'Be careful. This message has warning signs. Verify before you act.',
    high: 'Likely a SCAM. Do not pay, do not share OTP, do not click links.',
    critical: 'DANGER — this is almost certainly a SCAM. Stop now and hang up.',
  },
  ta: {
    safe: 'பாதுகாப்பாகத் தெரிகிறது. இருந்தாலும் OTP-ஐ யாரிடமும் சொல்லாதீர்கள்.',
    suspicious: 'கவனம். இந்த செய்தியில் எச்சரிக்கை அறிகுறிகள் உள்ளன. சரிபார்த்த பின் செயல்படுங்கள்.',
    high: 'இது மோசடியாக இருக்கலாம். பணம் அனுப்பாதீர்கள், OTP சொல்லாதீர்கள், லிங்கை தொடாதீர்கள்.',
    critical: 'ஆபத்து! இது நிச்சயமாக மோசடி. உடனே அழைப்பை துண்டியுங்கள்.',
  },
  hi: {
    safe: 'सुरक्षित लगता है। फिर भी किसी को OTP न बताएं।',
    suspicious: 'सावधान। इस संदेश में चेतावनी के संकेत हैं। कुछ करने से पहले जांच लें।',
    high: 'यह धोखाधड़ी हो सकती है। पैसे न भेजें, OTP न बताएं, लिंक न खोलें।',
    critical: 'खतरा! यह लगभग निश्चित रूप से धोखाधड़ी है। तुरंत कॉल काट दें।',
  },
  te: {
    safe: 'సురక్షితంగా కనిపిస్తోంది. అయినా OTP ఎవరికీ చెప్పకండి.',
    suspicious: 'జాగ్రత్త. ఈ సందేశంలో అనుమానాస్పద సంకేతాలు ఉన్నాయి. నిర్ధారించుకున్న తర్వాతే స్పందించండి.',
    high: 'ఇది మోసం కావచ్చు. డబ్బు పంపకండి, OTP చెప్పకండి, లింకులు క్లిక్ చేయకండి.',
    critical: 'ప్రమాదం! ఇది ఖచ్చితంగా మోసం. వెంటనే కాల్ కట్ చేయండి.',
  },
  kn: {
    safe: 'ಸುರಕ್ಷಿತವಾಗಿ ಕಾಣುತ್ತಿದೆ. ಆದರೂ ಯಾರಿಗೂ OTP ಹಂಚಬೇಡಿ.',
    suspicious: 'ಎಚ್ಚರ. ಈ ಸಂದೇಶದಲ್ಲಿ ಎಚ್ಚರಿಕೆ ಚಿಹ್ನೆಗಳಿವೆ. ಪರಿಶೀಲಿಸಿದ ನಂತರ ಮುಂದುವರಿಯಿರಿ.',
    high: 'ಇದು ವಂಚನೆಯಾಗಿರಬಹುದು. ಹಣ ಕಳುಹಿಸಬೇಡಿ, OTP ಹೇಳಬೇಡಿ, ಲಿಂಕ್ ಒತ್ತಬೇಡಿ.',
    critical: 'ಅಪಾಯ! ಇದು ಖಂಡಿತ ವಂಚನೆ. ತಕ್ಷಣ ಕರೆ ಕತ್ತರಿಸಿ.',
  },
  ml: {
    safe: 'സുരക്ഷിതമാണെന്ന് തോന്നുന്നു. എങ്കിലും OTP ആരോടും പങ്കിടരുത്.',
    suspicious: 'ശ്രദ്ധിക്കുക. ഈ സന്ദേശത്തിൽ അപകട സൂചനകളുണ്ട്. ഉറപ്പാക്കിയ ശേഷം മാത്രം പ്രതികരിക്കുക.',
    high: 'ഇത് തട്ടിപ്പാകാൻ സാധ്യതയുണ്ട്. പണം അയയ്ക്കരുത്, OTP പറയരുത്.',
    critical: 'അപകടം! ഇത് ഉറപ്പായും തട്ടിപ്പാണ്. ഉടൻ കോൾ കട്ട് ചെയ്യുക.',
  },
  bn: {
    safe: 'নিরাপদ মনে হচ্ছে। তবুও কখনো কাউকে OTP দেবেন না।',
    suspicious: 'সাবধান। এই বার্তায় সতর্কতার লক্ষণ রয়েছে। যাচাই করে পদক্ষেপ নিন।',
    high: 'এটি প্রতারণা হতে পারে। টাকা পাঠাবেন না, OTP দেবেন না, লিঙ্কে ক্লিক করবেন না।',
    critical: 'বিপদ! এটি নিশ্চিতভাবেই প্রতারণা। এখনই ফোন কেটে দিন।',
  },
  mr: {
    safe: 'सुरक्षित वाटते. तरीही कोणालाही OTP सांगू नका.',
    suspicious: 'सावधान. या संदेशात धोक्याची चिन्हे आहेत. खात्री करूनच कृती करा.',
    high: 'ही फसवणूक असू शकते. पैसे पाठवू नका, OTP देऊ नका, लिंक उघडू नका.',
    critical: 'धोका! ही नक्कीच फसवणूक आहे. ताबडतोब कॉल बंद करा.',
  },
  gu: {
    safe: 'સુરક્ષિત લાગે છે. તેમ છતાં કોઈને OTP આપશો નહીં.',
    suspicious: 'સાવધાન. આ સંદેશમાં ચેતવણીના સંકેતો છે. તપાસ કર્યા પછી જ આગળ વધો.',
    high: 'આ છેતરપિંડી હોઈ શકે છે. પૈસા મોકલશો નહીં, OTP આપશો નહીં.',
    critical: 'જોખમ! આ ચોક્કસ છેતરપિંડી છે. તરત જ કૉલ કાપી નાખો.',
  },
  pa: {
    safe: 'ਸੁਰੱਖਿਅਤ ਲੱਗਦਾ ਹੈ। ਫਿਰ ਵੀ ਕਿਸੇ ਨਾਲ OTP ਸਾਂਝਾ ਨਾ ਕਰੋ।',
    suspicious: 'ਸਾਵਧਾਨ। ਇਸ ਸੁਨੇਹੇ ਵਿੱਚ ਖ਼ਤਰੇ ਦੇ ਸੰਕੇਤ ਹਨ। ਜਾਂਚ ਕਰਕੇ ਹੀ ਕਾਰਵਾਈ ਕਰੋ।',
    high: 'ਇਹ ਧੋਖਾਧੜੀ ਹੋ ਸਕਦੀ ਹੈ। ਪੈਸੇ ਨਾ ਭੇਜੋ, OTP ਨਾ ਦੱਸੋ।',
    critical: 'ਖ਼ਤਰਾ! ਇਹ ਯਕੀਨੀ ਤੌਰ ਤੇ ਧੋਖਾਧੜੀ ਹੈ। ਤੁਰੰਤ ਕਾਲ ਕੱਟ ਦਿਓ।',
  },
  or: {
    safe: 'ସୁରକ୍ଷିତ ମନେହୁଏ। ତଥାପି କାହାକୁ OTP ଦିଅନ୍ତୁ ନାହିଁ।',
    suspicious: 'ସାବଧାନ। ଏହି ବାର୍ତ୍ତାରେ ସତର୍କ ସଙ୍କେତ ଅଛି। ଯାଞ୍ଚ କରି ପଦକ୍ଷେପ ନିଅନ୍ତୁ।',
    high: 'ଏହା ଠକେଇ ହୋଇପାରେ। ଟଙ୍କା ପଠାନ୍ତୁ ନାହିଁ, OTP ଦିଅନ୍ତୁ ନାହିଁ।',
    critical: 'ବିପଦ! ଏହା ନିଶ୍ଚିତ ଠକେଇ। ତୁରନ୍ତ କଲ୍ କାଟନ୍ତୁ।',
  },
  ur: {
    safe: 'محفوظ لگتا ہے۔ پھر بھی کسی کو OTP نہ بتائیں۔',
    suspicious: 'خبردار۔ اس پیغام میں خطرے کی علامات ہیں۔ تصدیق کے بعد عمل کریں۔',
    high: 'یہ دھوکہ دہی ہو سکتی ہے۔ پیسے نہ بھیجیں، OTP نہ بتائیں۔',
    critical: 'خطرہ! یہ یقینی طور پر دھوکہ ہے۔ فوراً کال کاٹ دیں۔',
  },
  as: {
    safe: 'নিৰাপদ যেন লাগিছে। তথাপিও কাকো OTP নিদিব।',
    suspicious: 'সাৱধান। এই বাৰ্তাত সতৰ্কতাৰ চিন আছে। পৰীক্ষা কৰি পদক্ষেপ লওক।',
    high: 'এইটো প্ৰৱঞ্চনা হ’ব পাৰে। টকা নপঠিয়াব, OTP নিদিব।',
    critical: 'বিপদ! এইটো নিশ্চিতভাৱে প্ৰৱঞ্চনা। লগে লগে ফোন কাটি দিয়ক।',
  },
});

const STEPS = Object.freeze({
  en: [
    'Hang up or stop replying. Real police never arrest anyone on a video call.',
    'If money was sent, call 1930 immediately — the first hour matters most.',
    'Report the number on Sanchar Saathi "Chakshu" and file at cybercrime.gov.in.',
    'Alert a trusted family member via Chat_Safe Family Hub.',
  ],
  ta: [
    'அழைப்பை துண்டியுங்கள். உண்மையான போலீஸ் வீடியோ அழைப்பில் கைது செய்ய மாட்டார்கள்.',
    'பணம் அனுப்பியிருந்தால் உடனே 1930-க்கு அழையுங்கள் — முதல் ஒரு மணி நேரம் முக்கியம்.',
    'சஞ்சார் சாத்தி "சக்ஷு"வில் எண்ணை புகாரளித்து cybercrime.gov.in-ல் புகார் கொடுங்கள்.',
    'நம்பிக்கையான குடும்ப உறுப்பினரிடம் உடனே சொல்லுங்கள்.',
  ],
  hi: [
    'कॉल काटें या जवाब देना बंद करें। असली पुलिस वीडियो कॉल पर गिरफ्तार नहीं करती।',
    'अगर पैसे भेज दिए हैं तो तुरंत 1930 पर कॉल करें — पहला घंटा सबसे ज़रूरी है।',
    'संचार साथी "चक्षु" पर नंबर की शिकायत करें और cybercrime.gov.in पर रिपोर्ट दर्ज करें।',
    'किसी भरोसेमंद परिवार वाले को तुरंत बताएं।',
  ],
  te: [
    'కాల్ కట్ చేయండి. నిజమైన పోలీసులు వీడియో కాల్‌లో ఎవరినీ అరెస్టు చేయరు.',
    'డబ్బు పంపితే వెంటనే 1930కు కాల్ చేయండి.',
    'cybercrime.gov.in మరియు సంచార్ సాథీ చక్షులో ఫిర్యాదు చేయండి.',
    'కుటుంబ సభ్యులకు వెంటనే తెలియజేయండి.',
  ],
  kn: [
    'ಕರೆ ಕತ್ತರಿಸಿ. ನಿಜವಾದ ಪೊಲೀಸರು ವೀಡಿಯೋ ಕರೆಯಲ್ಲಿ ಬಂಧಿಸುವುದಿಲ್ಲ.',
    'ಹಣ ಕಳುಹಿಸಿದ್ದರೆ ತಕ್ಷಣ 1930 ಗೆ ಕರೆ ಮಾಡಿ.',
    'cybercrime.gov.in ನಲ್ಲಿ ದೂರು ದಾಖಲಿಸಿ.',
    'ನಂಬಿಕಸ್ತ ಕುಟುಂಬದವರಿಗೆ ತಿಳಿಸಿ.',
  ],
  ml: [
    'കോൾ കട്ട് ചെയ്യുക. യഥാർത്ഥ പോലീസ് വീഡിയോ കോളിലൂടെ അറസ്റ്റ് ചെയ്യില്ല.',
    'പണം നഷ്ടപ്പെട്ടെങ്കിൽ ഉടൻ 1930-ൽ വിളിക്കുക.',
    'cybercrime.gov.in-ൽ പരാതി നൽകുക.',
    'വിശ്വസ്തരായ കുടുംബാംഗങ്ങളോട് പറയുക.',
  ],
  bn: [
    'কল কেটে দিন। আসল পুলিশ ভিডিও কলে গ্রেপ্তার করে না।',
    'টাকা পাঠালে এক্ষুনি 1930 নম্বরে কল করুন।',
    'cybercrime.gov.in এবং সঞ্চার সাথী চক্ষু-তে অভিযোগ জানান।',
    'পরিবারের বিশ্বস্ত সদস্যকে জানান।',
  ],
  mr: [
    'कॉल बंद करा. खरे पोलीस व्हिडिओ कॉलवर अटक करत नाहीत.',
    'पैसे पाठवले असल्यास ताबडतोब 1930 वर कॉल करा.',
    'cybercrime.gov.in वर तक्रार नोंदवा.',
    'विश्वासू कुटुंबीयांना कळवा.',
  ],
});

const DECOY_FALLBACK = Object.freeze({
  en: [
    'Oh dear, wait wait, let me find my reading glasses… which bank did you say you are calling from, kanna?',
    'My grandson set up this phone, I only know the green button. Can you explain slowly what "UPI" means?',
    'Hold on, the pressure cooker is whistling! Now, you were saying the parcel had what inside?',
    'Officer sir, my late husband was also in government service. Which office are you in exactly?',
  ],
  ta: [
    'அய்யோ, கொஞ்சம் பொறு கண்ணா, கண்ணாடி எங்கே வைத்தேன்… எந்த பேங்க்ல இருந்து பேசுறீங்க சொன்னீங்க?',
    'என் பேரன் தான் இந்த போனை செட் பண்ணான், எனக்கு பச்சை பட்டன் மட்டும் தெரியும். UPI-ன்னா என்னப்பா?',
    'இருங்க, குக்கர் விசில் அடிக்குது! ம்ம், அந்த பார்சல்ல என்ன இருந்ததுன்னு சொன்னீங்க?',
    'சார், என் வீட்டுக்காரரும் அரசு வேலையில தான் இருந்தார். நீங்க எந்த ஆபீஸ்ல இருக்கீங்க?',
  ],
  hi: [
    'अरे बेटा, रुको ज़रा, मेरा चश्मा कहाँ गया… तुम कौन से बैंक से बोल रहे हो, फिर से बताना?',
    'ये फोन मेरे पोते ने सेट किया है, मुझे बस हरा बटन आता है। ये UPI क्या होता है, धीरे से समझाओ?',
    'रुको, कुकर की सीटी बज रही है! हाँ, तुम कह रहे थे पार्सल में क्या मिला?',
    'साहब, मेरे पति भी सरकारी नौकरी में थे। आप किस दफ़्तर में हो, ठीक से बताओ?',
  ],
});

function decoyFallback(lang, turn) {
  const lines = localized(DECOY_FALLBACK, lang);
  const i = Math.abs(Math.trunc(Number(turn) || 0)) % lines.length;
  return lines[i];
}

function buildComplaint({ text, score, scamType, indicators, now = new Date() }) {
  const list = (label, arr) => (arr.length ? `${label}: ${arr.join(', ')}` : null);
  const excerpt = text.length > 600 ? `${text.slice(0, 600)}…` : text;
  const lines = [
    'NATIONAL CYBER CRIME REPORTING PORTAL — COMPLAINT DRAFT (prepared by Chat_Safe × Kavach)',
    `Date/time noted: ${now.toISOString()}`,
    `Suspected category: ${scamType}`,
    `Kavach risk score: ${score}/100`,
    '',
    'Suspect identifiers:',
    list('  UPI IDs', indicators.upiIds),
    list('  Phone numbers', indicators.phones),
    list('  Bank accounts', indicators.accounts),
    list('  IFSC', indicators.ifsc),
    list('  Links', indicators.urls),
    list('  Amounts mentioned', indicators.amounts),
    '',
    'Message / call transcript excerpt:',
    excerpt,
    '',
    'Next: call 1930 (if money was lost), file at https://cybercrime.gov.in, report the number at https://sancharsaathi.gov.in (Chakshu).',
  ].filter((l) => l !== null);
  return lines.join('\n');
}

const AGENT_TIPS = Object.freeze({
  en: [
    'Real police, CBI and RBI never arrest anyone on a video call and never ask you to transfer money to verify funds.',
    'Nobody — not your bank, not UPI support, not a courier — ever needs your OTP or PIN.',
    'Since October 2025, SEBI-registered brokers and advisers collect money only via "@valid" UPI IDs.',
    'For civic issues like broken pipes or roads, just say it — Urimai drafts a bilingual petition for your family.',
  ],
  ta: [
    'உண்மையான போலீஸ், சிபிஐ அல்லது ரிசர்வ் வங்கி வீடியோ அழைப்பில் கைது செய்ய மாட்டார்கள்.',
    'வங்கியோ கூரியரோ உங்களிடம் OTP அல்லது PIN கேட்கவே மாட்டார்கள்.',
    'உடைந்த குழாய் அல்லது சாலை பிரச்சனை என்றால் சொல்லுங்கள் — உரிமை உடனே மனு தயாரித்து உங்கள் குடும்பத்திற்கு அனுப்பும்.',
  ],
  hi: [
    'असली पुलिस, सीबीआई या आरबीआई कभी वीडियो कॉल पर गिरफ्तार नहीं करती और न ही पैसे ट्रांसफर करवाती है।',
    'कोई भी बैंक या कूरियर आपसे OTP या PIN नहीं मांगता।',
    'टूटी पाइप या सड़क की समस्या बताएं — उरिमाई तुरंत दो भाषाओं में आवेदन तैयार कर आपके परिवार को भेज देगा।',
  ],
});

function agentFallback(lang, turn, question = '') {
  const tips = localized(AGENT_TIPS, lang);
  const q = question.toLowerCase();
  if (/otp|pin|cvv|password|bank|kyc/.test(q)) return tips[1] || tips[0];
  if (/1930|lost|sent|money|cheat/.test(q)) return localized(STEPS, lang)[1];
  if (/valid|upi|sebi|stock|broker/.test(q)) return AGENT_TIPS.en[2];
  return tips[Math.abs(Math.trunc(Number(turn) || 0)) % tips.length];
}

module.exports = { OFFLINE_LANGS, localized, VERDICT, STEPS, decoyFallback, agentFallback, buildComplaint };
