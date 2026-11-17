'use strict';

/**
 * Urimai Engine — Civic Grievance & Last-Mile O2O Kit Generator.
 *
 * Bridges rural button-phone elders (who dial '9' and speak in their mother tongue)
 * with smartphone-savvy family members, generating:
 *   1. Bilingual Legal Petition (Official English + any of 23 Indian languages)
 *   2. Actionable O2O Kit (Photo prompt + 5-signature resident table + local office instructions)
 *   3. Solution 1: Digital-First Bypass (State CM Helpline & CPGRAMS portal formatter)
 *   4. Solution 2: Local Proxy WhatsApp Handoff (for neighbor / auto driver / CSC operator)
 */

const { safeLang, languageInfo } = require('./languages');
const { classifyIntent } = require('./rules');

/** Official State & National Digital Grievance Portals (Solution 1: Digital-First Bypass). */
const STATE_PORTALS = Object.freeze({
  'Tamil Nadu': {
    portalName: 'Mudhalvarin Mugavari (TN CM Helpline)',
    url: 'https://cmhelpline.tnega.org/',
    secondaryName: 'Namma Chennai App / Portal',
    secondaryUrl: 'https://erp.chennaicorporation.gov.in/pgr/',
    helpline: '1100',
    limitChars: 1000,
  },
  'National (All India)': {
    portalName: 'CPGRAMS (Centralized Public Grievance Portal)',
    url: 'https://pgportal.gov.in/',
    secondaryName: 'UMANG Citizen Portal',
    secondaryUrl: 'https://web.umang.gov.in/',
    helpline: '1800-11-1555',
    limitChars: 2000,
  },
  'Maharashtra': {
    portalName: 'Aaple Sarkar Grievance Portal',
    url: 'https://grievances.maharashtra.gov.in/',
    secondaryName: 'BMC Disaster / Civic Helpline',
    secondaryUrl: 'https://portal.mcgm.gov.in/',
    helpline: '1916',
    limitChars: 1500,
  },
  'Karnataka': {
    portalName: 'Janaspandana (Karnataka iPGRS)',
    url: 'https://ipgrs.karnataka.gov.in/',
    secondaryName: 'BBMP Sahaya 2.0',
    secondaryUrl: 'https://nammabengaluru.org.in/',
    helpline: '1902',
    limitChars: 1500,
  },
  'Kerala': {
    portalName: 'Kerala CMO Public Grievance Redressal',
    url: 'https://cmo.kerala.gov.in/',
    secondaryName: 'LSGD Citizen Portal',
    secondaryUrl: 'https://lsgkerala.gov.in/',
    helpline: '155300',
    limitChars: 1500,
  },
  'Andhra Pradesh': {
    portalName: 'Spandana / Public Grievance System',
    url: 'https://www.spandana.ap.gov.in/',
    secondaryName: 'AP Grama Sachivalayam',
    secondaryUrl: 'https://gramasachivalayam.ap.gov.in/',
    helpline: '1902',
    limitChars: 1500,
  },
  'Telangana': {
    portalName: 'Prajavani Grievance Portal',
    url: 'https://prajavani.telangana.gov.in/',
    secondaryName: 'MyGHMC Citizen App',
    secondaryUrl: 'https://www.ghmc.gov.in/',
    helpline: '040-21111111',
    limitChars: 1500,
  },
  'Uttar Pradesh': {
    portalName: 'IGRS Jansunwai (UP CM Helpline)',
    url: 'https://jansunwai.up.nic.in/',
    secondaryName: 'UP CM Helpline',
    secondaryUrl: 'https://cmhelpline.up.gov.in/',
    helpline: '1076',
    limitChars: 1500,
  },
  'West Bengal': {
    portalName: 'Sorasori Mukhyamantri Grievance',
    url: 'https://cm.wb.gov.in/',
    secondaryName: 'Banglar Sahayata Kendra',
    secondaryUrl: 'https://bsk.wb.gov.in/',
    helpline: '9137091370',
    limitChars: 1200,
  },
  'Gujarat': {
    portalName: 'CM SWAGAT Online Grievance',
    url: 'https://swagat.gujarat.gov.in/',
    secondaryName: 'Digital Gujarat',
    secondaryUrl: 'https://www.digitalgujarat.gov.in/',
    helpline: '1905',
    limitChars: 1500,
  },
});

const LANG_NATIVE_HEADERS = Object.freeze({
  ta: {
    heading: 'உரிமை (URIMAI) — பொதுமக்கள் குறைதீர் மனு',
    to: 'பெறுநர்: உதவிப் பொறியாளர் / செயல் அலுவலர்,',
    subject: 'பொருள்: அவசர பொது நல குறைதீர் கோரிக்கை',
    bodyPrefix: 'மதிப்பிற்குரிய ஐயா/அம்மா, எங்கள் தெருவில் ஏற்பட்டுள்ள கீழ்க்கண்ட குடிமைப் பிரச்சனையை உடனடியாக சரிசெய்யுமாறு தாழ்மையுடன் கேட்டுக்கொள்கிறோம்:',
    signTitle: 'பாதிக்கப்பட்ட குடியிருப்பாளர்களின் கையொப்பம் (குறைந்தபட்சம் 5 நபர்கள்)',
    handoffSpeech: 'உங்கள் குடிமைப் புகாரை புரிந்துகொண்டேன். சம்பந்தப்பட்ட அரசுத் துறைக்கு அதிகாரப்பூர்வ மனு தயாரிக்கப்பட்டு உங்கள் மகன்/மகளின் கைபேசிக்கு அனுப்பப்பட்டுள்ளது.',
  },
  hi: {
    heading: 'उरिमाई (URIMAI) — आधिकारिक जन शिकायत पत्र',
    to: 'सेवा में: कार्यकारी अधिकारी / सहायक अभियंता,',
    subject: 'विषय: तत्काल सार्वजनिक समस्या के समाधान हेतु निवेदन',
    bodyPrefix: 'महोदय/महोदया, हमारे क्षेत्र में उत्पन्न निम्नलिखित नागरिक समस्या के शीघ्र समाधान का विनम्र अनुरोध है:',
    signTitle: 'प्रभावित निवासियों के हस्ताक्षर (न्यूनतम 5 आवश्यक)',
    handoffSpeech: 'मैंने आपकी समस्या समझ ली है। संबंधित सरकारी विभाग के लिए आधिकारिक शिकायत तैयार करके आपके बेटे/बेटी के फोन पर भेज दी गई है।',
  },
  te: {
    heading: 'ఉరిమై (URIMAI) — అధికారిక ప్రజా ఫిర్యాదు పత్రం',
    to: 'గౌరవనీయులైన కార్యనిర్వాహక అధికారి గారికి,',
    subject: 'విషయం: తక్షణ పౌర సమస్య పరిష్కార అభ్యర్థన',
    bodyPrefix: 'అయ్యా/అమ్మా, మా వీధిలో ఏర్పడిన ఈ క్రింది ప్రజా సమస్యను వెంటనే పరిష్కరించవలసిందిగా కోరుతున్నాము:',
    signTitle: 'బాధిత నివాసితుల సంతకాలు (కనీసం 5 అవసరం)',
    handoffSpeech: 'మీ సమస్య నాకు అర్థమైంది. సంబంధిత శాఖకు అధికారిక ఫిర్యాదును సిద్ధం చేసి మీ కుటుంబ సభ్యుల ఫోన్‌కు పంపాను.',
  },
  kn: {
    heading: 'ಉರಿಮೈ (URIMAI) — ಅಧಿಕೃತ ನಾಗರಿಕ ದೂರು ಪತ್ರ',
    to: 'ಗೆ: ಕಾರ್ಯನಿರ್ವಾಹಕ ಅಧಿಕಾರಿ / ಸಹಾಯಕ ಇಂಜಿನಿಯರ್,',
    subject: 'ವಿಷಯ: ತುರ್ತು ನಾಗರಿಕ ಸಮಸ್ಯೆ ಪರಿಹಾರಕ್ಕಾಗಿ ಮನವಿ',
    bodyPrefix: 'ಮಾನ್ಯರೇ, ನಮ್ಮ ಬೀದಿಯಲ್ಲಿ ಉಂಟಾಗಿರುವ ಕೆಳಗಿನ ಸಮಸ್ಯೆಯನ್ನು ತಕ್ಷಣವೇ ಸರಿಪಡಿಸುವಂತೆ ವಿನಂತಿಸುತ್ತೇವೆ:',
    signTitle: 'ಬಾಧಿತ ನಿವಾಸಿಗಳ ಸಹಿಗಳು (ಕನಿಷ್ಠ 5 ಅಗತ್ಯ)',
    handoffSpeech: 'ನಿಮ್ಮ ಸಮಸ್ಯೆ ನನಗೆ ಅರ್ಥವಾಗಿದೆ. ಸಂಬಂಧಪಟ್ಟ ಇಲಾಖೆಗೆ ಅಧಿಕೃತ ದೂರು ಸಿದ್ಧಪಡಿಸಿ ನಿಮ್ಮ ಮಗ/ಮಗಳ ಫೋನ್‌ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.',
  },
  ml: {
    heading: 'ഉരിമൈ (URIMAI) — ഔദ്യോഗിക പൊതുജന പരാതി',
    to: 'സ്വീകർത്താവ്: എക്സിക്യൂട്ടീവ് ഓഫീസർ / അസിസ്റ്റന്റ് എഞ്ചിനീയർ,',
    subject: 'വിഷയം: അടിയന്തര പൊതുപ്രശ്നം പരിഹരിക്കുന്നതിനുള്ള അപേക്ഷ',
    bodyPrefix: 'ബഹുമാനപ്പെട്ട സർ/മാഡം, ഞങ്ങളുടെ പ്രദേശത്തെ താഴെ പറയുന്ന പ്രശ്നം ഉടൻ പരിഹരിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു:',
    signTitle: 'ബാധിതരായ താമസക്കാരുടെ ഒപ്പുകൾ (കുറഞ്ഞത് 5 എണ്ണം)',
    handoffSpeech: 'നിങ്ങളുടെ പരാതി മനസ്സിലായി. ബന്ധപ്പെട്ട വകുപ്പിലേക്കുള്ള ഔദ്യോഗിക അപേക്ഷ തയ്യാറാക്കി നിങ്ങളുടെ കുടുംബാംഗത്തിന്റെ ഫോണിലേക്ക് അയച്ചിട്ടുണ്ട്.',
  },
  bn: {
    heading: 'উরিমাই (URIMAI) — সরকারি নাগরিক অভিযোগপত্র',
    to: 'প্রতি: কার্যনির্বাহী আধিকারিক / সহকারী প্রকৌশলী,',
    subject: 'বিষয়: জরুরি নাগরিক সমস্যার দ্রুত সমাধানের আবেদন',
    bodyPrefix: 'মহাশয়/মহাশয়া, আমাদের এলাকায় সৃষ্ট নিম্নলিখিত নাগরিক সমস্যাটি অবিলম্বে সমাধানের জন্য অনুরোধ জানাচ্ছি:',
    signTitle: 'ক্ষতিগ্রস্ত বাসিন্দাদের স্বাক্ষর (ন্যূনতম ৫ জন)',
    handoffSpeech: 'আমি আপনার সমস্যাটি বুঝতে পেরেছি। সংশ্লিষ্ট দপ্তরের জন্য সরকারি অভিযোগপত্র তৈরি করে আপনার পরিবারের ফোনে পাঠানো হয়েছে।',
  },
  mr: {
    heading: 'उरिमाई (URIMAI) — अधिकृत नागरी तक्रार अर्ज',
    to: 'प्रति: कार्यकारी अधिकारी / सहाय्यक अभियंता,',
    subject: 'विषय: तातडीच्या नागरी समस्येचे निराकरण करण्याबाबत',
    bodyPrefix: 'महोदय/महोदया, आमच्या परिसरातील खालील नागरी समस्येचे त्वरित निराकरण करावे ही नम्र विनंती:',
    signTitle: 'प्रभावित रहिवाशांच्या स्वाक्षऱ्या (किमान ५ आवश्यक)',
    handoffSpeech: 'तुमची समस्या समजली आहे. संबंधित विभागाकडे अधिकृत तक्रार तयार करून तुमच्या मुलाच्या/मुलीच्या फोनवर पाठवली आहे.',
  },
  gu: {
    heading: 'ઉરિમાઈ (URIMAI) — સત્તાવાર નાગરિક ફરિયાદ પત્ર',
    to: 'પ્રતિ: કાર્યકારી અધિકારી / મદદનીશ ઇજનેર,',
    subject: 'વિષય: તાત્કાલિક નાગરિક સમસ્યાના નિરાકરણ અંગે વિનંતી',
    bodyPrefix: 'સાહેબશ્રી, અમારા વિસ્તારમાં નીચે મુજબની નાગરિક સમસ્યાનો તાત્કાલિક ઉકેલ લાવવા નમ્ર વિનંતી છે:',
    signTitle: 'અસરગ્રસ્ત રહેવાસીઓની સહીઓ (ઓછામાં ઓછી 5 જરૂરી)',
    handoffSpeech: 'તમારી સમસ્યા સમજાઈ ગઈ છે. સંબંધિત વિભાગ માટે સત્તાવાર ફરિયાદ તૈયાર કરીને તમારા પરિવારના ફોન પર મોકલી દેવામાં આવી છે.',
  },
  pa: {
    heading: 'ਉਰੀਮਾਈ (URIMAI) — ਅਧਿਕਾਰਤ ਨਾਗਰਿਕ ਸ਼ਿਕਾਇਤ ਪੱਤਰ',
    to: 'ਸੇਵਾ ਵਿਖੇ: ਕਾਰਜਕਾਰੀ ਅਧਿਕਾਰੀ / ਸਹਾਇਕ ਇੰਜੀਨੀਅਰ,',
    subject: 'ਵਿਸ਼ਾ: ਤੁਰੰਤ ਨਾਗਰਿਕ ਸਮੱਸਿਆ ਦੇ ਹੱਲ ਲਈ ਬੇਨਤੀ',
    bodyPrefix: 'ਸ੍ਰੀਮਾਨ/ਸ੍ਰੀਮਤੀ ਜੀ, ਸਾਡੀ ਗਲੀ ਵਿੱਚ ਹੇਠ ਲਿਖੀ ਸਮੱਸਿਆ ਨੂੰ ਤੁਰੰਤ ਠੀਕ ਕਰਨ ਦੀ ਬੇਨਤੀ ਹੈ:',
    signTitle: 'ਪ੍ਰਭਾਵਿਤ ਨਿਵਾਸੀਆਂ ਦੇ ਦਸਤਖਤ (ਘੱਟੋ-ਘੱਟ 5 ਲੋੜੀਂਦੇ)',
    handoffSpeech: 'ਮੈਂ ਤੁਹਾਡੀ ਸਮੱਸਿਆ ਸਮਝ ਗਿਆ ਹਾਂ। ਸਬੰਧਤ ਵਿਭਾਗ ਲਈ ਅਧਿਕਾਰਤ ਸ਼ਿਕਾਇਤ ਤਿਆਰ ਕਰਕੇ ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਦੇ ਫ਼ੋਨ ਤੇ ਭੇਜ ਦਿੱਤੀ ਗਈ ਹੈ।',
  },
  or: {
    heading: 'ଉରିମାଇ (URIMAI) — ସରକାରୀ ନାଗରିକ ଅଭିଯୋଗ ପତ୍ର',
    to: 'ପ୍ରତି: କାର୍ଯ୍ୟନିର୍ବାହୀ ଅଧିକାରୀ / ସହକାରୀ ଯନ୍ତ୍ରୀ,',
    subject: 'ବିଷୟ: ଜରୁରୀ ନାଗରିକ ସମସ୍ୟାର ତୁରନ୍ତ ସମାଧାନ ପାଇଁ ଅନୁରୋଧ',
    bodyPrefix: 'ମହାଶୟ/ମହାଶୟା, ଆମ ଅଞ୍ଚଳରେ ଦେଖାଦେଇଥିବା ନିମ୍ਨଲିଖିତ ସମସ୍ୟାର ଶୀଘ୍ର ସମାଧାନ ପାଇଁ ଅନୁରୋଧ କରୁଛୁ:',
    signTitle: 'ପ୍ରଭାବିତ ବାସିନ୍ଦାଙ୍କ ଦସ୍ତଖତ (ସର୍ବନିମ୍ନ ୫ଟି ଆବଶ୍ୟକ)',
    handoffSpeech: 'ମୁଁ ଆପଣଙ୍କ ସମସ୍ୟା ବୁଝିପାରିଛି। ସମ୍ପୃକ୍ତ ବିଭାଗ ପାଇଁ ସରକାରୀ ଅଭିଯୋଗ ପ୍ରସ୍ତୁତ କରି ଆପଣଙ୍କ ପରିବାର ଫୋନକୁ ପଠାଯାଇଛି।',
  },
  ur: {
    heading: 'اریمائی (URIMAI) — سرکاری شہری شکایت نامہ',
    to: 'بخدمت: ایگزیکٹو آفیسر / اسسٹنٹ انجینئر،',
    subject: 'عنوان: فوری شہری مسئلے کے حل کی درخواست',
    bodyPrefix: 'جنابِ عالی، گزارش ہے کہ ہماری گلی میں درج ذیل عوامی مسئلہ فوری طور پر حل کیا جائے:',
    signTitle: 'متاثرہ رہائشیوں کے دستخط (کم از کم 5 ضروری)',
    handoffSpeech: 'میں نے آپ کا مسئلہ سمجھ لیا ہے۔ متعلقہ محکمے کے لیے سرکاری شکایت تیار کر کے آپ کے خاندان کے فون پر بھیج دی گئی ہے۔',
  },
  as: {
    heading: 'উৰিমাই (URIMAI) — চৰকাৰী নাগৰিক অভিযোগ পত্ৰ',
    to: 'প্ৰতি: কাৰ্যবাহী বিষয়া / সহকাৰী অভিযন্তা,',
    subject: 'বিষয়: জৰুৰী নাগৰিক সমস্যা সমাধানৰ বাবে আবেদন',
    bodyPrefix: 'মহোদয়/মহোদয়া, আমাৰ এলেকাত হোৱা তলৰ সমস্যাটো শীঘ্ৰে সমাধান কৰিবলৈ অনুৰোধ জনালোঁ:',
    signTitle: 'ক্ষতিগ্ৰস্ত বাসিন্দাসকলৰ স্বাক্ষৰ (নূন্যতম ৫ জন)',
    handoffSpeech: 'মই আপোনাৰ সমস্যাটো বুজি পাইছোঁ। সংশ্লিষ্ট বিভাগলৈ চৰকাৰী অভিযোগপত্ৰ প্ৰস্তুত কৰি আপোনাৰ পৰিয়ালৰ ফোনলৈ পঠিওৱা হৈছে।',
  },
});

function inferDepartment(text) {
  const c = classifyIntent(text);
  if (c.department) return c.department;
  return 'Local Gram Panchayat / Municipal Ward Office';
}

function inferOfficeName(department, location = 'Local Ward') {
  if (/water/i.test(department)) return `${location} Municipal Water Board / TWAD Office`;
  if (/road|highways|pwd/i.test(department)) return `${location} Municipal Engineering / PWD Office`;
  if (/electricity|discom|tneb/i.test(department)) return `${location} Assistant Engineer (TNEB / DISCOM) Office`;
  if (/sanitation|drainage/i.test(department)) return `${location} Health & Sanitation Ward Office`;
  return `${location} Gram Panchayat / Municipal Ward Office`;
}

function extractDuration(text) {
  const m = String(text || '').match(/\b(\d+\s*(?:days?|weeks?|months?|hours?)|yesterday|last\s*week|3\s*days)\b/i);
  return m ? m[0] : 'several days';
}

/**
 * Generate a complete, bilingual Urimai Grievance Kit.
 * @param {{
 *   text: string,
 *   lang?: string,
 *   location?: string,
 *   state?: string,
 *   reporter?: string,
 *   department?: string,
 *   aiDraft?: { department?: string, summary?: string, english_letter?: string, regional_letter?: string, portal_text?: string } | null
 * }} opts
 */
function buildUrimaiKit(opts = {}) {
  const text = String(opts.text || '').trim();
  const lang = safeLang(opts.lang || 'ta');
  const langInfo = languageInfo(lang);
  const location = String(opts.location || 'Ward 12, Coimbatore').trim();
  const state = opts.state && STATE_PORTALS[opts.state] ? opts.state : 'Tamil Nadu';
  const reporter = String(opts.reporter || 'Appa (Keypad Phone — Speed Dial 9)').trim();
  const department = opts.aiDraft?.department || opts.department || inferDepartment(text);
  const office = inferOfficeName(department, location);
  const duration = extractDuration(text);
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const kitId = `URM-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const summary = opts.aiDraft?.summary || (text.length > 140 ? `${text.slice(0, 140)}…` : text);

  const englishLetter = opts.aiDraft?.english_letter || [
    `Date: ${today}`,
    `Ref: ${kitId}`,
    '',
    'To,',
    `The Executive Officer / Assistant Engineer,`,
    `${department},`,
    `${office}.`,
    '',
    `Subject: Urgent Civic Grievance — ${summary}`,
    '',
    'Respected Sir / Madam,',
    '',
    `We, the undersigned residents of ${location}, bring to your urgent notice the following public civic issue reported for the past ${duration}:`,
    '',
    `"${text}"`,
    '',
    'This unresolved civic breakdown is causing severe hardship, public health and safety risks for elders, women, and school-going children in our neighbourhood.',
    '',
    'Under the Citizen Charter and Right to Public Services, we kindly request your office to inspect the site immediately, assign a repair team, and resolve this grievance within 48 hours.',
    '',
    'Thanking you,',
    `Yours faithfully,`,
    `Residents of ${location} (Filed via Urimai Civic Bridge)`,
  ].join('\n');

  const nativeMeta = LANG_NATIVE_HEADERS[lang] || LANG_NATIVE_HEADERS.ta;
  const regionalLetter = opts.aiDraft?.regional_letter || (lang === 'en'
    ? englishLetter
    : [
        `${nativeMeta.heading} (${langInfo.native})`,
        `நாள் / Date: ${today}  |  Ref: ${kitId}`,
        '',
        nativeMeta.to,
        `${department}, ${office}.`,
        '',
        `${nativeMeta.subject}`,
        '',
        `${nativeMeta.bodyPrefix}`,
        `"${text}"`,
        '',
        `இடம் / Location: ${location} (${duration})`,
        '',
        `${nativeMeta.signTitle}:`,
        '1. ____________________  2. ____________________  3. ____________________',
        '4. ____________________  5. ____________________',
      ].join('\n'));

  const portal = STATE_PORTALS[state] || STATE_PORTALS['Tamil Nadu'];
  const portalCopyText = opts.aiDraft?.portal_text ||
    `[${department}] Location: ${location} | Duration: ${duration}. Grievance: ${text} (Citizen Petition Ref: ${kitId}. Immediate inspection & repair requested under Citizen Charter.)`.slice(0, portal.limitChars);

  const proxyUrl = `proxy.html?kit=${encodeURIComponent(kitId)}&dept=${encodeURIComponent(department)}&loc=${encodeURIComponent(location)}&lang=${encodeURIComponent(lang)}&summary=${encodeURIComponent(summary)}`;
  const proxyWhatsAppMessage =
    `🙏 *Urimai Civic Help Needed (${kitId})*\n` +
    `My parent reported a civic issue in *${location}*:\n` +
    `"${summary}"\n\n` +
    `I am currently out of town. Could you please tap this secure link, snap 1 photo of the spot, and press Generate PDF?\n` +
    `👉 ${proxyUrl}`;

  const handoffReply = lang === 'en'
    ? `I understand the civic issue regarding ${department}. I have drafted an official bilingual complaint and sent the Actionable Urimai Kit to your family's phone to submit.`
    : `${nativeMeta.handoffSpeech} (${department})`;

  return {
    kitId,
    createdAt: new Date().toISOString(),
    reporter,
    location,
    state,
    lang,
    langName: langInfo.name,
    langNative: langInfo.native,
    department,
    office,
    duration,
    summary,
    originalText: text,
    handoffReply,
    englishLetter,
    regionalLetter,
    signatureTableTitle: 'Signatures of Affected Residents (Minimum 5 required)',
    signatureTableNativeTitle: nativeMeta.signTitle,
    offlineInstructions: `Print this document, collect 5 signatures from your street, and hand-deliver it to the ${office}.`,
    digitalBypass: {
      state,
      portalName: portal.portalName,
      portalUrl: portal.url,
      secondaryName: portal.secondaryName,
      secondaryUrl: portal.secondaryUrl,
      helpline: portal.helpline,
      copyText: portalCopyText,
    },
    localProxy: {
      proxyUrl,
      whatsappText: proxyWhatsAppMessage,
    },
  };
}

module.exports = { STATE_PORTALS, buildUrimaiKit, inferDepartment };
