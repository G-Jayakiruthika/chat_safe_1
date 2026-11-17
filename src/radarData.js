'use strict';

/**
 * Seed data for Tab 1: Radar (Live Threat Scroll with Auto-Redaction, Civic Watch,
 * and Daily Scam & Civic Video News Reels).
 */

const { redactPII } = require('./extract');

const RAW_SCAM_FEED = [
  {
    id: 'rad-1',
    city: 'Coimbatore',
    category: 'Electricity Cut-Off SMS',
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
    city: 'Bengaluru',
    category: 'Fake IPO / Stock Group',
    severity: 'high',
    reports: 305,
    timeAgo: '1h ago',
    rawText: 'Hi Ananya, join our SEBI VIP Institutional IPO Group! Guaranteed 8% daily returns. Send ₹25,000 to rajesh.trader@okaxis and message +91 99001 44556.',
  },
  {
    id: 'rad-4',
    city: 'Madurai',
    category: 'PM Kisan / Subsidy APK',
    severity: 'high',
    reports: 194,
    timeAgo: '2h ago',
    rawText: 'Dear Murugan, your PM Kisan ₹6,000 subsidy is pending. Download PMKisanVerify.apk or call Mr. Karthik at 94432 11009 with your OTP.',
  },
  {
    id: 'rad-5',
    city: 'Mumbai',
    category: 'Part-Time YouTube Task',
    severity: 'high',
    reports: 520,
    timeAgo: '3h ago',
    rawText: 'Hello Priya, earn ₹3,000/day liking YouTube videos! Complete prepaid task of ₹500 to taskdesk.pay@ybl. Contact Rahul at 98200 77889.',
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
    city: 'Bengaluru',
    ward: 'Ward 84 · Indiranagar',
    department: 'Sanitation & Drainage Wing',
    title: 'Open stormwater drain overflowing near market',
    summary: 'Mosquito breeding and foul smell; bilingual Kannada/English petition drafted.',
    status: 'Under Review',
    upvotes: 34,
    timeAgo: '4h ago',
  },
];

const VIDEO_NEWS_REELS = [
  {
    id: 'reel-1',
    title: 'ALERT: TNEB "Power Cut Tonight 9:30 PM" SMS Scam',
    city: 'Coimbatore',
    category: 'Scam Alert',
    creator: 'Cyber Dost Tamil Nadu',
    verified: true,
    verifiedBadge: 'Verified Cyber Volunteer ✓',
    durationSec: 18,
    views: '48.2K',
    likes: 3420,
    accent: '#f87171',
    scenes: [
      { badge: 'SCAM HOOK', headline: '"Power cut tonight 9:30 PM"', body: 'Fraudsters send fake TNEB disconnection SMS asking you to call a private mobile number.' },
      { badge: 'RED FLAG', headline: 'Private mobile + APK link', body: 'Real electricity boards never ask you to install AnyDesk or pay to personal UPI IDs.' },
      { badge: 'PROTECT', headline: 'Verify in official app · Call 1930', body: 'Check your consumer number only in the official TNEB app. Report scammers on Chakshu.' },
    ],
  },
  {
    id: 'reel-2',
    title: 'Digital Arrest: Why Real CBI Never Uses Video Calls',
    city: 'Chennai',
    category: 'Scam Alert',
    creator: 'I4C Citizen Desk',
    verified: true,
    verifiedBadge: 'Verified Official Partner ✓',
    durationSec: 20,
    views: '112K',
    likes: 8910,
    accent: '#fb923c',
    scenes: [
      { badge: 'THE TRAP', headline: '"Stay on Skype — Do not tell family"', body: 'Fake police claim your Aadhaar is in a FedEx drugs parcel and lock you on video.' },
      { badge: 'THE LAW', headline: 'No "Digital Arrest" in Indian Law', body: 'Police and RBI never demand "verification transfers" to safe accounts.' },
      { badge: 'URIMAI TIP', headline: 'Press Speed-Dial 9 for Kavach', body: 'Elders on keypad phones can dial 9 to verify any suspicious call in Tamil or Hindi.' },
    ],
  },
  {
    id: 'reel-3',
    title: 'How Urimai Fixed a Broken Water Pipe in 48 Hours',
    city: 'Madurai',
    category: 'Civic Impact',
    creator: 'Ward 12 Mitra',
    verified: true,
    verifiedBadge: 'Verified Civic Reporter ✓',
    durationSec: 18,
    views: '29.4K',
    likes: 2150,
    accent: '#38bdf8',
    scenes: [
      { badge: 'STEP 1 · VOICE', headline: 'Appa dials 9 on his keypad phone', body: 'Speaks in Tamil: "The street water pipe broke 3 days ago."' },
      { badge: 'STEP 2 · HANDOFF', headline: 'Son gets Urimai Kit in hostel', body: 'Clicks "Ask Local Proxy" — neighbor snaps photo via WhatsApp link.' },
      { badge: 'STEP 3 · ACTION', headline: 'Bilingual PDF + CM Helpline', body: 'Submitted on Mudhalvarin Mugavari & local Panchayat. Pipe repaired!' },
    ],
  },
  {
    id: 'reel-4',
    title: 'SEBI @valid Rule: Spot Fake Stock & IPO Groups',
    city: 'Bengaluru',
    category: 'Pay-Check',
    creator: 'FinSafe India',
    verified: true,
    verifiedBadge: 'Verified Educator ✓',
    durationSec: 16,
    views: '64.7K',
    likes: 5110,
    accent: '#34d399',
    scenes: [
      { badge: 'NEW RULE', headline: 'Look for "@valid" in Broker UPI', body: 'SEBI-registered brokers and mutual funds only collect via NPCI @valid handles.' },
      { badge: 'RED FLAG', headline: 'rajesh.trader@ybl is personal!', body: 'Guaranteed 8% daily return WhatsApp groups are 100% fraudulent.' },
      { badge: 'CHECK FIRST', headline: 'Paste UPI in Chat_Safe Pay-Check', body: 'Verify any handle in 1 second before sending a single rupee.' },
    ],
  },
];

function getRadarFeed(city = 'All') {
  const matchCity = (c) => !city || city === 'All' || c.toLowerCase() === String(city).toLowerCase();
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
