'use strict';

/**
 * Seed data for Tab 1: Radar (Region pills, Feed mode switcher,
 * Live Scam Threat Scroll with Auto-Redaction, Civic Watch, and Verified Video News & Reels).
 */

const { redactPII } = require('./extract');

const RAW_SCAM_FEED = [
  {
    id: 'rad-1',
    city: 'Coimbatore',
    category: 'TNEB Power Cut SMS',
    severity: 'critical',
    reports: 412,
    timeAgo: '12m ago',
    rawText: 'Dear Ramesh Kumar, your TNEB power will be disconnected tonight 9:30 PM due to unpaid bill. Call Officer Vikram on +91 98401 22334 or pay ₹1,850 to tneb.helpdesk@ybl immediately.',
  },
  {
    id: 'rad-2',
    city: 'Chennai',
    category: 'Digital Arrest (Fake CBI)',
    severity: 'critical',
    reports: 689,
    timeAgo: '28m ago',
    rawText: 'This is Inspector Sharma from CBI Mumbai calling Ms. Lakshmi Narayanan. Your Aadhaar 4421 8890 1122 is linked to a FedEx drugs parcel. Do not tell family. Transfer ₹1,50,000 to account 501002345678 IFSC HDFC0001234.',
  },
  {
    id: 'rad-3',
    city: 'Madurai',
    category: 'Bank KYC Expiry',
    severity: 'high',
    reports: 215,
    timeAgo: '45m ago',
    rawText: 'Dear Murugan, your SBI YONO account is blocked today. Click bit.ly/sbi-kyc-verify or call Mr. Karthik at 94432 11009 with OTP 491023.',
  },
  {
    id: 'rad-4',
    city: 'Trichy',
    category: 'YouTube Task Job',
    severity: 'high',
    reports: 178,
    timeAgo: '1h ago',
    rawText: 'Hello Priya, earn ₹5,000/day liking YouTube videos! Deposit ₹3,000 prepaid task fee to taskdesk.pay@ybl. Contact Rahul at 98200 77889.',
  },
  {
    id: 'rad-5',
    city: 'Salem',
    category: 'AI Voice Clone Emergency',
    severity: 'critical',
    reports: 96,
    timeAgo: '2h ago',
    rawText: 'Caller cloned son Karthik voice claiming road accident near Salem bypass, pleaded for ₹25,000 urgent transfer to stranger UPI emergency.help@okaxis.',
  },
  {
    id: 'rad-6',
    city: 'Bengaluru',
    category: 'Fake IPO / Stock Group',
    severity: 'high',
    reports: 305,
    timeAgo: '2h ago',
    rawText: 'Hi Ananya, join our SEBI VIP Institutional IPO Group! Guaranteed 8% daily returns. Send ₹25,000 to rajesh.trader@okaxis and message +91 99001 44556.',
  },
  {
    id: 'rad-7',
    city: 'Mumbai',
    category: 'Courier Customs Scam',
    severity: 'high',
    reports: 520,
    timeAgo: '3h ago',
    rawText: 'FedEx Mumbai: Parcel in name of Rohan Mehta held at customs with illegal passports. Call +91 98201 33445 or pay ₹18,500.',
  },
];

const CIVIC_WATCH_FEED = [
  {
    id: 'civ-1',
    city: 'Coimbatore',
    ward: 'Ward 12 · RS Puram',
    department: 'Municipal Water Board',
    title: 'Main drinking water pipe broken for 3 days',
    summary: 'Reported via Speed-Dial 9 voice call by a senior citizen. Heavy water wastage and contamination risk.',
    status: 'Action Kit Sent (3/5 signatures)',
    upvotes: 47,
    timeAgo: '18m ago',
  },
  {
    id: 'civ-2',
    city: 'Madurai',
    ward: 'Ward 4 · Temple Street',
    department: 'State Electricity Board (TNEB)',
    title: 'Street light pole dark for 3 weeks near temple',
    summary: 'Safety hazard for women and elders returning after evening prayers.',
    status: 'Filed on Mudhalvarin Mugavari',
    upvotes: 63,
    timeAgo: '1h ago',
  },
  {
    id: 'civ-3',
    city: 'Chennai',
    ward: 'Ward 118 · Adyar',
    department: 'Highways & Municipal PWD',
    title: 'Deep waterlogged pothole near school bus stop',
    summary: 'Two-wheelers skidding daily. Local proxy neighbor photo attached to Urimai PDF.',
    status: 'Local Proxy Photo Attached',
    upvotes: 91,
    timeAgo: '2h ago',
  },
  {
    id: 'civ-4',
    city: 'Salem',
    ward: 'Omalur Junction',
    department: 'Roads & Highways',
    title: '3-foot deep pothole causing motorcycle falls',
    summary: '8 resident signatures collected on bilingual Tamil + English Urimai petition.',
    status: 'Signatures Collected (8 residents)',
    upvotes: 38,
    timeAgo: '4h ago',
  },
  {
    id: 'civ-5',
    city: 'Trichy',
    ward: 'Ward 22 · Srirangam',
    department: 'Sanitation & Drainage Wing',
    title: 'Overflowing stormwater drain near primary school',
    summary: 'Reported via Speed-Dial 9 in Tamil; forwarded to Local Proxy e-Seva center.',
    status: 'Under Review',
    upvotes: 29,
    timeAgo: '5h ago',
  },
];

const VIDEO_NEWS_REELS = [
  {
    id: 'reel-1',
    title: '⚠️ Beware: "TNEB Power Cut at 9:30 PM" WhatsApp SMS Scam Exposed',
    city: 'Coimbatore',
    category: 'Electricity Scam',
    creator: 'TrueSafe Cyber Cell (Verified)',
    verified: true,
    verifiedBadge: 'Verified Cyber Cell ✓',
    duration: '0:45',
    durationSec: 18,
    views: '124K views',
    likes: 3420,
    accent: '#7c3aed',
    summary: 'TNEB never sends SMS threatening disconnection within hours or asking you to call personal mobile numbers. Always pay only via official app.',
    scenes: [
      { badge: 'SCAM HOOK', headline: '"Power cut tonight 9:30 PM"', body: 'Fraudsters send fake TNEB disconnection SMS asking you to call a private mobile number.' },
      { badge: 'RED FLAG', headline: 'Private mobile + APK link', body: 'Real electricity boards never ask you to install AnyDesk or pay to personal UPI IDs.' },
      { badge: 'PROTECT', headline: 'Verify in official app · Call 1930', body: 'Check your consumer number only in the official TNEB app. Report scammers on Chakshu.' },
    ],
  },
  {
    id: 'reel-2',
    title: '🚨 Digital Arrest Scam: How Scammers Impersonate CBI & Supreme Court',
    city: 'Chennai',
    category: 'Digital Arrest',
    creator: 'Cyber Crime Volunteer Network',
    verified: true,
    verifiedBadge: 'Verified Partner ✓',
    duration: '0:58',
    durationSec: 20,
    views: '89K views',
    likes: 8910,
    accent: '#6366f1',
    summary: 'No law enforcement agency in India conducts arrests or interrogations via Skype/WhatsApp video calls. Hang up immediately and dial 1930.',
    scenes: [
      { badge: 'THE TRAP', headline: '"Stay on Skype — Do not tell family"', body: 'Fake police claim your Aadhaar is in a FedEx drugs parcel and lock you on video.' },
      { badge: 'THE LAW', headline: 'No "Digital Arrest" in Indian Law', body: 'Police and RBI never demand "verification transfers" to safe accounts.' },
      { badge: 'URIMAI TIP', headline: 'Press Speed-Dial 9 for Kavach', body: 'Elders on keypad phones can dial 9 to verify any suspicious call in Tamil or Hindi.' },
    ],
  },
  {
    id: 'reel-3',
    title: '💡 AI Voice Cloning: How Hackers Mimic Your Child\'s Voice in Tamil',
    city: 'Madurai',
    category: 'AI Voice Cloning',
    creator: 'TechSafe Tamil Nadu',
    verified: true,
    verifiedBadge: 'Verified Reporter ✓',
    duration: '0:52',
    durationSec: 18,
    views: '67K views',
    likes: 5110,
    accent: '#9333ea',
    summary: 'Scammers take 3 seconds of audio from social media to clone voices. Establish a secret "Family Safe Word" to verify true emergencies.',
    scenes: [
      { badge: 'THE CLONE', headline: '"Amma, I had an accident — send ₹25,000"', body: 'AI mimics a loved one\'s voice from reels and pressures elders for instant UPI.' },
      { badge: 'VERIFY', headline: 'Ask your Family Safe Word', body: 'Hang up and call back on the saved family number before sending any money.' },
      { badge: 'REPORT', headline: 'Dial 1930 within the Golden Hour', body: 'Use Chat_Safe AI Scanner to draft your 1930 cybercrime report in seconds.' },
    ],
  },
  {
    id: 'reel-4',
    title: '⚖️ How Urimai Fixed a Broken Water Pipe in 48 Hours via Speed-Dial 9',
    city: 'Salem',
    category: 'Urimai Civic',
    creator: 'Ward 12 Mitra',
    verified: true,
    verifiedBadge: 'Verified Civic Mitra ✓',
    duration: '0:48',
    durationSec: 18,
    views: '41K views',
    likes: 2890,
    accent: '#2563eb',
    summary: 'Rural father dialed 9 in Tamil; son received the bilingual PDF + photo prompt in hostel and filed via Mudhalvarin Mugavari & Local Proxy.',
    scenes: [
      { badge: 'STEP 1 · VOICE', headline: 'Appa dials 9 on his keypad phone', body: 'Speaks in Tamil: "The street water pipe broke 3 days ago."' },
      { badge: 'STEP 2 · HANDOFF', headline: 'Son gets Urimai Kit in hostel', body: 'Clicks "Ask Local Proxy" — neighbor snaps photo via WhatsApp link.' },
      { badge: 'STEP 3 · ACTION', headline: 'Bilingual PDF + CM Helpline', body: 'Submitted on Mudhalvarin Mugavari & local Panchayat. Pipe repaired!' },
    ],
  },
];

function getRadarFeed(city = 'All') {
  const matchCity = (c) => !city || city === 'All' || city === 'All India' || c.toLowerCase() === String(city).toLowerCase();
  const scams = RAW_SCAM_FEED.filter((s) => matchCity(s.city)).map((s) => {
    const r = redactPII(s.rawText);
    return {
      ...s,
      redactedText: r.redacted,
      redactedCount: r.count,
      redactedTags: r.tags,
    };
  });
  const civic = CIVIC_WATCH_FEED.filter((c) => matchCity(c.city));
  const reels = VIDEO_NEWS_REELS.filter((v) => matchCity(v.city));
  return { city, scams, civic, reels };
}

module.exports = { RAW_SCAM_FEED, CIVIC_WATCH_FEED, VIDEO_NEWS_REELS, getRadarFeed };
