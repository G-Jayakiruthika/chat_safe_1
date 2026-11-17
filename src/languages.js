'use strict';

/**
 * English plus all 22 languages in the Eighth Schedule of the Constitution of India.
 * Each entry includes its BCP-47 speech tag, native name, RTL flag, and the
 * Speed-Dial '9' voice-agent welcome prompt.
 */
const LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', native: 'English', speech: 'en-IN', greeting: 'Hello! Tell me what happened — scam call or civic problem.' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', speech: 'as-IN', greeting: 'নমস্কাৰ! কি হ’ল কওক — প্ৰৱঞ্চনা নে ৰাজহুৱা সমস্যা?' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', speech: 'bn-IN', greeting: 'নমস্কার! কী হয়েছে বলুন — প্রতারণা নাকি নাগরিক সমস্যা?' },
  { code: 'brx', name: 'Bodo', native: 'बड़ो', speech: 'brx-IN', greeting: 'खुलुमबाय! मा जाखो खोन्था — ठगनाय ना गामि समस्या?' },
  { code: 'doi', name: 'Dogri', native: 'डोगरी', speech: 'doi-IN', greeting: 'नमस्ते! क्या होया दस्सो — धोखाधड़ी जां इलाके दी समस्या?' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', speech: 'gu-IN', greeting: 'નમસ્તે! શું થયું કહો — છેતરપિંડી કે નાગરિક સમસ્યા?' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', speech: 'hi-IN', greeting: 'नमस्ते! बताइए क्या हुआ — कोई धोखाधड़ी या इलाके की समस्या?' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', speech: 'kn-IN', greeting: 'ನಮಸ್ಕಾರ! ಏನಾಯಿತು ಹೇಳಿ — ವಂಚನೆ ಅಥವಾ ನಾಗರಿಕ ಸಮಸ್ಯೆಯೇ?' },
  { code: 'ks', name: 'Kashmiri', native: 'کٲشُر', speech: 'ks-IN', rtl: true, greeting: 'آداب! ونیو کیا گۆو — دھوکہ دہی یا علاقی مسئلہ؟' },
  { code: 'kok', name: 'Konkani', native: 'कोंकणी', speech: 'kok-IN', greeting: 'नमस्कार! कितें जालें सांगात — फसवणूक काय नागरी समस्या?' },
  { code: 'mai', name: 'Maithili', native: 'मैथिली', speech: 'mai-IN', greeting: 'प्रणाम! की भेल कहू — ठगी वा गाम-मोहल्ला के समस्या?' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', speech: 'ml-IN', greeting: 'നമസ്കാരം! എന്താണ് സംഭവിച്ചത് എന്ന് പറയൂ — തട്ടിപ്പോ പൊതുപ്രശ്നമോ?' },
  { code: 'mni', name: 'Manipuri', native: 'ꯃꯤꯇꯩꯂꯣꯟ', speech: 'mni-IN', greeting: 'ꯈꯨꯔꯨꯝꯖꯔꯤ! ꯀꯔꯤ ꯊꯣꯛꯈꯤꯕꯒꯦ ꯍꯥꯌꯕꯤꯌꯨ?' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', speech: 'mr-IN', greeting: 'नमस्कार! काय झाले सांगा — फसवणूक की नागरी तक्रार?' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', speech: 'ne-NP', greeting: 'नमस्ते! के भयो भन्नुहोस् — ठगी वा स्थानीय समस्या?' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', speech: 'or-IN', greeting: 'ନମସ୍କାର! କଣ ହେଲା କୁହନ୍ତୁ — ଠକେଇ ନା ଅଞ୍ଚଳର ସମସ୍ୟା?' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', speech: 'pa-IN', greeting: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਦੱਸੋ ਕੀ ਹੋਇਆ — ਧੋਖਾਧੜੀ ਜਾਂ ਇਲਾਕੇ ਦੀ ਸਮੱਸਿਆ?' },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', speech: 'sa-IN', greeting: 'नमस्ते! किं अभवत् इति वदतु — वञ्चना वा नागरिकसमस्या?' },
  { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', speech: 'sat-IN', greeting: 'ᱡᱚᱦᱟᱨ! ᱪᱮᱫ ᱦᱩᱭᱮᱱᱟ ᱞᱟᱹᱭ ᱢᱮ?' },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي', speech: 'sd-IN', rtl: true, greeting: 'سلام! ٻڌايو ڇا ٿيو — دوکو يا علائقي جو مسئلو؟' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', speech: 'ta-IN', greeting: 'வணக்கம்! என்ன நடந்தது சொல்லுங்கள் — மோசடியா அல்லது ஊர் பிரச்சனையா?' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', speech: 'te-IN', greeting: 'నమస్కారం! ఏమి జరిగిందో చెప్పండి — మోసమా లేక ప్రజా సమస్యా?' },
  { code: 'ur', name: 'Urdu', native: 'اردو', speech: 'ur-IN', rtl: true, greeting: 'آداب! بتائیے کیا ہوا — کوئی دھوکہ دہی یا علاقے کا مسئلہ؟' },
]);

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

/** @param {unknown} code @returns {string} a supported code, defaulting to English */
const safeLang = (code) => (typeof code === 'string' && BY_CODE.has(code) ? code : 'en');

/** @param {string} code */
const languageName = (code) => BY_CODE.get(safeLang(code)).name;

/** @param {string} code */
const languageInfo = (code) => BY_CODE.get(safeLang(code));

/** Unicode script ranges -> most likely language. */
const SCRIPT_HINTS = Object.freeze([
  [/[\u0B80-\u0BFF]/g, 'ta'],
  [/[\u0C00-\u0C7F]/g, 'te'],
  [/[\u0C80-\u0CFF]/g, 'kn'],
  [/[\u0D00-\u0D7F]/g, 'ml'],
  [/[\u0980-\u09FF]/g, 'bn'],
  [/[\u0A80-\u0AFF]/g, 'gu'],
  [/[\u0A00-\u0A7F]/g, 'pa'],
  [/[\u0B00-\u0B7F]/g, 'or'],
  [/[\u1C50-\u1C7F]/g, 'sat'],
  [/[\uABC0-\uABFF]/g, 'mni'],
  [/[\u0600-\u06FF]/g, 'ur'],
  [/[\u0900-\u097F]/g, 'hi'],
]);

/**
 * Guess the language of a message from its script.
 * @param {unknown} text
 * @returns {string}
 */
function detectLanguage(text) {
  if (typeof text !== 'string' || !text) return 'en';
  let best = 'en';
  let bestCount = 0;
  for (const [re, code] of SCRIPT_HINTS) {
    const n = (text.match(re) || []).length;
    if (n > bestCount) {
      best = code;
      bestCount = n;
    }
  }
  return best;
}

module.exports = { LANGUAGES, safeLang, languageName, languageInfo, detectLanguage };
