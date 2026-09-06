export type SupportedLanguage = 'en' | 'hi' | 'mr';

export interface PromptTemplate {
  id: string;
  label: string;
  query: string;
}

export interface LocaleContent {
  appTagline: string;
  evidenceBtn: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  samplePromptsTitle: string;
  inputPlaceholder: string;
  sendBtnAria: string;
  agentsReasoning: string;
  viewEvidenceBtn: (count: number) => string;
  statusLabels: Record<string, string>;
  confidenceLabels: Record<string, string>;
  decisiveFactorsTitle: string;
  nextActionLabel: string;
  warningsTitle: string;
  drawerTitleEvidence: string;
  drawerTitleTrace: string;
  drawerEmptyEvidence: string;
  drawerEmptyTrace: string;
  prompts: PromptTemplate[];
  back: string;
  backToStart: string;
  newChat: string;
  chatTitle: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, LocaleContent> = {
  en: {
    appTagline: 'Smart Autonomous Marine Understanding, Decision & Risk Assistant',
    evidenceBtn: 'Evidence',
    welcomeTitle: 'SAMUDRA Marine Assistant',
    welcomeSubtitle: 'Ask about fishing zones, departure safety, hazards, or route comparisons along the Maharashtra coast.',
    samplePromptsTitle: 'Canonical Evaluation Queries',
    inputPlaceholder: 'Ask about fishing zones, safety, hazards, or routes...',
    sendBtnAria: 'Send query',
    agentsReasoning: 'Agents analyzing ocean models and safety criteria...',
    viewEvidenceBtn: (count: number) => `📋 View ${count} verified evidence source${count > 1 ? 's' : ''}`,
    statusLabels: {
      GO: 'GO — Safe / Favorable Conditions',
      CAUTION: 'CAUTION — Elevated Marine Risk',
      NO_GO: 'NO-GO — Hazardous Departure Advised Against',
      UNKNOWN: 'UNKNOWN — Missing or Stale Critical Data',
      INFORMATIONAL: 'INFORMATIONAL — Advisory Only',
    },
    confidenceLabels: {
      HIGH: 'High Confidence',
      MEDIUM: 'Medium Confidence',
      LOW: 'Low Confidence',
    },
    decisiveFactorsTitle: 'Decisive Factors',
    nextActionLabel: 'Recommended Action',
    warningsTitle: 'Operational Alerts & Fallbacks',
    drawerTitleEvidence: 'Verified Evidence',
    drawerTitleTrace: 'Agent Activity & Audit Trail',
    drawerEmptyEvidence: 'No evidence records attached to this response.',
    drawerEmptyTrace: 'No agent trace events logged.',
    prompts: [
      {
        id: 'pfz',
        label: '🐟 Nearest PFZ Ground',
        query: 'Where is the nearest Potential Fishing Zone today from Ratnagiri?',
      },
      {
        id: 'safety',
        label: '⚓ Departure Safety Check',
        query: 'Is it safe to leave tomorrow at 6 AM from Ratnagiri?',
      },
      {
        id: 'hazard',
        label: '⚠️ Hazard & Geofence Alert',
        query: 'Any cyclone, lightning or restricted-water risk on this trip?',
      },
      {
        id: 'route',
        label: '🧭 Safe Route Comparison',
        query: 'Which route from Ratnagiri to the PFZ has the lowest risk?',
      },
    ],
    back: 'Back',
    backToStart: 'Back to Start',
    newChat: 'New Query',
    chatTitle: 'Maritime Consultation',
  },
  hi: {
    appTagline: 'स्मार्ट स्वायत्त सागरी समझ, निर्णय और जोखिम सहायक',
    evidenceBtn: 'साक्ष्य एवं प्रमाण',
    welcomeTitle: 'समुद्र (SAMUDRA) सागरी सहायक',
    welcomeSubtitle: 'महाराष्ट्र तट पर मत्स्य क्षेत्र, प्रस्थान सुरक्षा, मौसम के खतरे या सुरक्षित मार्गों के बारे में पूछें।',
    samplePromptsTitle: 'मानक परीक्षण प्रश्न (Canonical Queries)',
    inputPlaceholder: 'मत्स्य क्षेत्र, सुरक्षा, मौसम के खतरे या सुरक्षित मार्ग के बारे में पूछें...',
    sendBtnAria: 'प्रश्न भेजें',
    agentsReasoning: 'एजेंट समुद्री डेटा और सुरक्षा मानकों का विश्लेषण कर रहे हैं...',
    viewEvidenceBtn: (count: number) => `📋 ${count} सत्यापित साक्ष्य स्रोत देखें`,
    statusLabels: {
      GO: 'सुरक्षित (GO) — प्रस्थान अनुकूल व सुरक्षित',
      CAUTION: 'सावधानी (CAUTION) — बढ़ा हुआ समुद्री जोखिम',
      NO_GO: 'असुरक्षित (NO-GO) — प्रस्थान न करने की सख्त सलाह',
      UNKNOWN: 'अज्ञात (UNKNOWN) — महत्वपूर्ण डेटा अनुपलब्ध',
      INFORMATIONAL: 'सूचनात्मक (INFORMATIONAL) — केवल परामर्श',
    },
    confidenceLabels: {
      HIGH: 'उच्च आत्मविश्वास',
      MEDIUM: 'मध्यम आत्मविश्वास',
      LOW: 'निम्न आत्मविश्वास',
    },
    decisiveFactorsTitle: 'प्रमुख निर्णायक कारक',
    nextActionLabel: 'अनुशंसित अगली कार्रवाई',
    warningsTitle: 'परिचालन चेतावनी एवं सूचनाएं',
    drawerTitleEvidence: 'सत्यापित साक्ष्य एवं डेटा स्रोत',
    drawerTitleTrace: 'एजेंट गतिविधि एवं ऑडिट ट्रेल',
    drawerEmptyEvidence: 'इस उत्तर के साथ कोई साक्ष्य संलग्न नहीं है।',
    drawerEmptyTrace: 'कोई एजेंट ट्रेस रिकॉर्ड उपलब्ध नहीं है।',
    prompts: [
      {
        id: 'pfz',
        label: '🐟 निकटतम मत्स्य क्षेत्र (PFZ)',
        query: 'रत्नागिरी से आज सबसे निकटतम संभावित मत्स्य क्षेत्र (PFZ) कहाँ है?',
      },
      {
        id: 'safety',
        label: '⚓ प्रस्थान सुरक्षा जांच',
        query: 'क्या कल सुबह 6 बजे रत्नागिरी से मछली पकड़ने जाना सुरक्षित है?',
      },
      {
        id: 'hazard',
        label: '⚠️ चक्रवात व भू-सीमा चेतावनी',
        query: 'क्या इस यात्रा में चक्रवात, बिजली या प्रतिबंधित क्षेत्र का कोई खतरा है?',
      },
      {
        id: 'route',
        label: '🧭 सुरक्षित मार्ग तुलना',
        query: 'रत्नागिरी से PFZ के लिए कौन सा समुद्री मार्ग सबसे सुरक्षित है?',
      },
    ],
    back: 'वापस',
    backToStart: 'शुरुआत पर वापस',
    newChat: 'नया प्रश्न',
    chatTitle: 'सागरीय परामर्श',
  },
  mr: {
    appTagline: 'स्मार्ट स्वायत्त सागरी आकलन, निर्णय आणि जोखीम सहाय्यक',
    evidenceBtn: 'सागरी पुरावा',
    welcomeTitle: 'समुद्र (SAMUDRA) सागरी सहाय्यक',
    welcomeSubtitle: 'कोकण व महाराष्ट्र किनारपट्टीवरील मासेमारी क्षेत्र, प्रस्थान सुरक्षितता, सागरी धोके किंवा सुरक्षित मार्गांबद्दल विचारा.',
    samplePromptsTitle: 'प्रामाणिक सागरी प्रश्न (Canonical Queries)',
    inputPlaceholder: 'मासेमारी क्षेत्र, सुरक्षितता, हवामानाचे धोके किंवा मार्गाबद्दल विचारा...',
    sendBtnAria: 'प्रश्न पाठवा',
    agentsReasoning: 'एजंट सागरी परिस्थिती आणि सुरक्षितता नियमांचे विश्लेषण करत आहेत...',
    viewEvidenceBtn: (count: number) => `📋 ${count} पडताळलेले अधिकृत पुरावे पहा`,
    statusLabels: {
      GO: 'सुरक्षित (GO) — समुद्रात जाणे अनुकूल व सुरक्षित',
      CAUTION: 'सावधगिरी (CAUTION) — वाढलेला सागरी धोका, दक्षता बाळगा',
      NO_GO: 'धोकादायक (NO-GO) — समुद्रात न जाण्याचा स्पष्ट सल्ला',
      UNKNOWN: 'अज्ञात (UNKNOWN) — आवश्यक माहिती किंवा अंदाज उपलब्ध नाही',
      INFORMATIONAL: 'माहितीपूर्ण (INFORMATIONAL) — केवळ मार्गदर्शक माहिती',
    },
    confidenceLabels: {
      HIGH: 'उच्च विश्वासार्हता',
      MEDIUM: 'मध्यम विश्वासार्हता',
      LOW: 'कमी विश्वासार्हता',
    },
    decisiveFactorsTitle: 'महत्त्वाचे निर्णायक घटक',
    nextActionLabel: 'पुढील कृती सल्ला',
    warningsTitle: 'सागरी सतर्कता सूचना व पर्यायी नोंदी',
    drawerTitleEvidence: 'पडताळलेले अधिकृत पुरावे (INCOIS / IMD)',
    drawerTitleTrace: 'एजंट कृती इतिहास व ऑडिट ट्रेल',
    drawerEmptyEvidence: 'या सल्ल्यासोबत कोणताही पुरावा जोडलेला नाही.',
    drawerEmptyTrace: 'कोणतीही एजंट नोंद उपलब्ध नाही.',
    prompts: [
      {
        id: 'pfz',
        label: '🐟 जवळचे मासेमारी क्षेत्र (PFZ)',
        query: 'रत्नागिरी जवळ सर्वात जवळचे संभाव्य मत्स्य क्षेत्र (PFZ) कुठे आहे?',
      },
      {
        id: 'safety',
        label: '⚓ प्रस्थान सुरक्षितता तपासणी',
        query: 'उद्या सकाळी ६ वाजता रत्नागिरीहून मासेमारीसाठी जाणे सुरक्षित आहे का?',
      },
      {
        id: 'hazard',
        label: '⚠️ चक्रीवादळ व भू-कुंपण धोका',
        query: 'या प्रवासात चक्रीवादळ, वीज किंवा प्रतिबंधित सागरी क्षेत्राचा काही धोका आहे का?',
      },
      {
        id: 'route',
        label: '🧭 सुरक्षित सागरी मार्ग तुलना',
        query: 'रत्नागिरीवरून कोणता सागरी मार्ग सर्वात सुरक्षित आहे?',
      },
    ],
    back: 'मागे',
    backToStart: 'सुरुवातीस जा',
    newChat: 'नवीन प्रश्न',
    chatTitle: 'सागरी सल्लागार',
  },
};

/**
 * Canonical phrase mapping dictionary for cross-lingual message translation.
 */
interface TranslationEntry {
  en: string;
  hi: string;
  mr: string;
}

export const CANONICAL_TRANSLATION_MAP: TranslationEntry[] = [
  // Sample Prompts
  {
    en: 'Where is the nearest Potential Fishing Zone today from Ratnagiri?',
    hi: 'रत्नागिरी से आज सबसे निकटतम संभावित मत्स्य क्षेत्र (PFZ) कहाँ है?',
    mr: 'रत्नागिरी जवळ सर्वात जवळचे संभाव्य मत्स्य क्षेत्र (PFZ) कुठे आहे?',
  },
  {
    en: 'Is it safe to leave tomorrow at 6 AM from Ratnagiri?',
    hi: 'क्या कल सुबह 6 बजे रत्नागिरी से मछली पकड़ने जाना सुरक्षित है?',
    mr: 'उद्या सकाळी ६ वाजता रत्नागिरीहून मासेमारीसाठी जाणे सुरक्षित आहे का?',
  },
  {
    en: 'Any cyclone, lightning or restricted-water risk on this trip?',
    hi: 'क्या इस यात्रा में चक्रवात, बिजली या प्रतिबंधित क्षेत्र का कोई खतरा है?',
    mr: 'या प्रवासात चक्रीवादळ, वीज किंवा प्रतिबंधित सागरी क्षेत्राचा काही धोका आहे का?',
  },
  {
    en: 'Which route from Ratnagiri to the PFZ has the lowest risk?',
    hi: 'रत्नागिरी से PFZ के लिए कौन सा समुद्री मार्ग सबसे सुरक्षित है?',
    mr: 'रत्नागिरीवरून कोणता सागरी मार्ग सर्वात सुरक्षित आहे?',
  },

  // Canonical Assistant Answers
  {
    en: 'The nearest Potential Fishing Zone is approximately 42.6 km southwest of Ratnagiri Harbor, bearing 245°. The zone shows favorable SST (28.4°C) and chlorophyll-a concentration (1.2 mg/m³).',
    hi: 'रत्नागिरी बंदरगाह से दक्षिण-पश्चिम में लगभग 42.6 किमी (दिशा 245°) की दूरी पर निकटतम संभावित मत्स्य क्षेत्र (PFZ) स्थित है। अनुकूल समुद्री सतह तापमान (28.4°C) और क्लोरोफिल-ए (1.2 mg/m³) दर्ज किया गया है।',
    mr: 'रत्नागिरी बंदरापासून नैऋत्येस अंदाजे 42.6 किमी (दिशा 245°) अंतरावर संभाव्य मत्स्य क्षेत्र (PFZ) आढळले आहे. अनुकूल सागरी पृष्ठभाग तापमान (28.4°C) आणि क्लोरोफिल-ए (1.2 mg/m³) नोंदवले गेले आहे.',
  },
  {
    en: 'Departure from Ratnagiri tomorrow at 06:00 is advised against (NO-GO). Severe sea state with significant wave heights of 3.4m and active IMD squall alert.',
    hi: 'रत्नागिरी से कल सुबह 06:00 बजे प्रस्थान न करने की सख्त सलाह दी जाती है (NO-GO)। समुद्र में 3.4 मीटर की खतरनाक लहरें और IMD द्वारा जारी सक्रिय तूफान की चेतावनी प्रभावी है।',
    mr: 'रत्नागिरीवरून उद्या सकाळी 06:00 वाजता प्रस्थान न करण्याचा सल्ला दिला जात आहे (NO-GO). 3.4 मीटरच्या धोकादायक लाटा आणि IMD ची सक्रिय वादळी चेतावणी सुरू आहे.',
  },
  {
    en: 'Coastal hazard alert: Active IMD squall advisory across Ratnagiri coastal waters. Keep clear of restricted naval boundary zones.',
    hi: 'तटीय चेतावनी: रत्नागिरी के तटीय जलक्षेत्र में IMD की तेज हवाओं और तूफान की सक्रिय चेतावनी। नौसैनिक प्रतिबंधित सीमा क्षेत्रों से दूर रहें।',
    mr: 'किनारपट्टी धोक्याचा इशारा: रत्नागिरी सागरी क्षेत्रात IMD चा वादळी वारे इशारा लागू आहे. प्रतिबंधित नौदल सीमा क्षेत्रांपासून दूर राहा.',
  },
  {
    en: 'Route Comparison: Recommended Route 1 via coastal passage has lowest cumulative risk. Deep-sea route crosses elevated wave height corridor.',
    hi: 'मार्ग तुलना: तटीय मार्ग 1 सबसे कम संचयी जोखिम वाला अनुशंसित मार्ग है। गहरे समुद्र का मार्ग ऊंची लहरों के गलियारे से होकर गुजरता है।',
    mr: 'मार्ग तुलना: किनारपट्टी मार्ग 1 हा सर्वात कमी धोक्याचा शिफारस केलेला मार्ग आहे. खोल समुद्राचा मार्ग उंच लाटांच्या पट्ट्यातून जातो.',
  },

  // Decisive factors
  {
    en: 'Significant wave height 3.4m exceeds craft safety ceiling (2.5m)',
    hi: 'महत्वपूर्ण लहर ऊंचाई 3.4 मी शिल्प सुरक्षा सीमा (2.5 मी) से अधिक है',
    mr: 'महत्त्वाची लाट उंची 3.4 मी बोटीच्या सुरक्षा मर्यादेपेक्षा (2.5 मी) जास्त आहे',
  },
  {
    en: 'IMD coastal squall warning active across Konkan coast until 14:00 tomorrow',
    hi: 'कल दोपहर 14:00 बजे तक कोंकण तट पर IMD तटीय तूफान चेतावनी सक्रिय',
    mr: 'उद्या दुपारी 14:00 वाजेपर्यंत कोकण किनारपट्टीवर IMD किनारपट्टी वादळी चेतावणी सक्रिय',
  },
  {
    en: 'PFZ zone PFZ-MH-20260905-01 identified 42.6 km from harbor',
    hi: 'बंदरगाह से 42.6 किमी की दूरी पर मत्स्य क्षेत्र PFZ-MH-20260905-01 चिन्हित',
    mr: 'बंदरापासून 42.6 किमी अंतरावर PFZ-MH-20260905-01 मत्स्य क्षेत्र निश्चित',
  },
  {
    en: 'Sea conditions within safe operational limits',
    hi: 'समुद्री स्थितियां सुरक्षित परिचालन सीमा के भीतर हैं',
    mr: 'सागरी परिस्थिती सुरक्षित कार्य मर्यादेत आहे',
  },
  {
    en: 'SST 28.4°C favorable for target species',
    hi: 'लक्षित प्रजातियों के लिए समुद्री तापमान (28.4°C) अनुकूल है',
    mr: 'माशांच्या प्रजातींसाठी सागरी पृष्ठभाग तापमान (28.4°C) अनुकूल आहे',
  },

  // Recommendations & Next Actions
  {
    en: 'High risk of craft swamping due to elevated wave heights and squall conditions.',
    hi: 'ऊंची लहरों और तेज तूफान के कारण नाव पलटने का अत्यधिक जोखिम।',
    mr: 'उंच लाटा आणि वादळी परिस्थितीमुळे बोट उलटण्याचा मोठा धोका.',
  },
  {
    en: 'Favorable conditions for fishing trip to nearest PFZ.',
    hi: 'निकटतम मत्स्य क्षेत्र की यात्रा के लिए अनुकूल और सुरक्षित स्थितियां।',
    mr: 'जवळच्या मत्स्य क्षेत्राच्या मासेमारी प्रवासासाठी अनुकूल परिस्थिती.',
  },
  {
    en: 'Postpone departure until wave heights abate below 2.0m (expected after 18:00 tomorrow).',
    hi: 'लहरों की ऊंचाई 2.0 मीटर से नीचे आने तक प्रस्थान स्थगित करें (कल 18:00 के बाद अपेक्षित)।',
    mr: 'लाटांची उंची 2.0 मीटरपेक्षा कमी होईपर्यंत प्रस्थान पुढे ढकला (उद्या संध्याकाळी 18:00 नंतर अपेक्षित).',
  },
  {
    en: 'Proceed with trip planning. Check departure safety before leaving.',
    hi: 'यात्रा योजना के साथ आगे बढ़ें। प्रस्थान करने से पहले सुरक्षा स्थिति पुनः जांचें।',
    mr: 'प्रवासाचे नियोजन सुरू करा. निघण्यापूर्वी प्रस्थान सुरक्षिततेची खात्री करा.',
  },

  // Suggested Followups
  {
    en: 'Check safety window for tomorrow evening',
    hi: 'कल शाम के लिए सुरक्षित प्रस्थान समय जांचें',
    mr: 'उद्या संध्याकाळसाठी सुरक्षित वेळ तपासा',
  },
  {
    en: 'Where is the nearest safe anchorage near Ratnagiri?',
    hi: 'रत्नागिरी के पास सबसे निकटतम सुरक्षित लंगरगाह (anchorage) कहाँ है?',
    mr: 'रत्नागिरी जवळ सर्वात सुरक्षित बंदर/थांबा कुठे आहे?',
  },
  {
    en: 'Is it safe to depart for this PFZ tomorrow at 6 AM?',
    hi: 'क्या कल सुबह 6 बजे इस PFZ के लिए प्रस्थान करना सुरक्षित है?',
    mr: 'उद्या सकाळी ६ वाजता या PFZ कडे जाणे सुरक्षित आहे का?',
  },
  {
    en: 'Show alternative PFZ options further south',
    hi: 'दक्षिण में आगे वैकल्पिक मत्स्य क्षेत्र (PFZ) विकल्प दिखाएं',
    mr: 'दक्षिणेकडील पर्यायी मासेमारी क्षेत्रे (PFZ) दाखवा',
  },
];

/**
 * Normalizes text for lenient phrase matching (ignores case, extra spaces, trailing punctuation).
 */
function normalizeForMatch(str: string): string {
  return str.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?'"॥।]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Translates general text or phrases to target language using the canonical dictionary.
 */
export function translateText(text: string, targetLang: SupportedLanguage): string {
  if (!text || !targetLang) return text;
  const clean = normalizeForMatch(text);

  for (const entry of CANONICAL_TRANSLATION_MAP) {
    if (
      normalizeForMatch(entry.en) === clean ||
      normalizeForMatch(entry.hi) === clean ||
      normalizeForMatch(entry.mr) === clean
    ) {
      return entry[targetLang];
    }
  }

  // Check substring matches for longer responses
  for (const entry of CANONICAL_TRANSLATION_MAP) {
    if (
      (clean.includes('nearest potential fishing zone') || clean.includes('pfz') || clean.includes('मत्स्य')) &&
      clean.includes('ratnagiri') &&
      entry.en.includes('Potential Fishing Zone')
    ) {
      return entry[targetLang];
    }
    if (
      (clean.includes('departure from ratnagiri') || clean.includes('no-go') || clean.includes('3.4m') || clean.includes('squall')) &&
      entry.en.includes('NO-GO')
    ) {
      return entry[targetLang];
    }
    if (
      (clean.includes('hazard') || clean.includes('squall') || clean.includes('naval') || clean.includes('restricted')) &&
      entry.en.includes('hazard alert')
    ) {
      return entry[targetLang];
    }
    if (
      (clean.includes('route comparison') || clean.includes('route 1') || clean.includes('lowest cumulative risk')) &&
      entry.en.includes('Route Comparison')
    ) {
      return entry[targetLang];
    }
  }

  return text;
}

/**
 * Translates chat message content, taking into account intent and canonical patterns.
 */
export function translateChatMessage(
  content: string,
  targetLang: SupportedLanguage,
  intent?: string
): string {
  if (!content) return content;

  // Intent-directed canonical translation
  if (intent) {
    if (intent === 'NEAREST_PFZ' || intent === 'PFZ') {
      const match = CANONICAL_TRANSLATION_MAP.find(e => e.en.includes('Potential Fishing Zone'));
      if (match) return match[targetLang];
    } else if (intent === 'GO_NO_GO_SAFETY') {
      const match = CANONICAL_TRANSLATION_MAP.find(e => e.en.includes('NO-GO'));
      if (match) return match[targetLang];
    } else if (intent === 'HAZARD_BOUNDARY' || intent === 'HAZARDS') {
      const match = CANONICAL_TRANSLATION_MAP.find(e => e.en.includes('hazard alert'));
      if (match) return match[targetLang];
    } else if (intent === 'SAFER_ROUTE' || intent === 'ROUTE') {
      const match = CANONICAL_TRANSLATION_MAP.find(e => e.en.includes('Route Comparison'));
      if (match) return match[targetLang];
    }
  }

  // Standard phrase translation
  return translateText(content, targetLang);
}

