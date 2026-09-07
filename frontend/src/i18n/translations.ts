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
  micBtnAria: string;
  micRecordingAria: string;
  micTranscribingAria: string;
  recordingIndicator: string;
  transcribingIndicator: string;
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
    micBtnAria: 'Record voice query',
    micRecordingAria: 'Stop recording and transcribe',
    micTranscribingAria: 'Transcribing voice audio...',
    recordingIndicator: 'Recording voice...',
    transcribingIndicator: 'Transcribing...',
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
    micBtnAria: 'आवाज इनपुट (वॉयस रिकॉर्ड)',
    micRecordingAria: 'रिकॉर्डिंग रोकें और रूपांतरित करें',
    micTranscribingAria: 'आवाज रूपांतरित हो रही है...',
    recordingIndicator: 'आवाज रिकॉर्ड हो रही है...',
    transcribingIndicator: 'पहचाना जा रहा है...',
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
    micBtnAria: 'आवाज इनपुट (व्हॉइस रेकॉर्ड)',
    micRecordingAria: 'रेकॉर्डिंग थांबवा आणि पाठवा',
    micTranscribingAria: 'आवाज रूपांतरित होत आहे...',
    recordingIndicator: 'आवाज रेकॉर्ड होत आहे...',
    transcribingIndicator: 'ओळखले जात आहे...',
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
    en: 'When will sea conditions improve?',
    hi: 'समुद्र की स्थिति कब सुधरेगी?',
    mr: 'सागरी परिस्थिती कधी सुधारेल?',
  },
  {
    en: 'Alternative sheltered route options',
    hi: 'तट के पास सुरक्षित वैकल्पिक मार्ग',
    mr: 'पर्यायी सुरक्षित/आश्रय असलेले सागरी मार्ग',
  },
  {
    en: 'Port authority emergency contacts',
    hi: 'पत्तन प्राधिकरण आपातकालीन संपर्क',
    mr: 'बंदर प्राधिकरण आणीबाणी संपर्क',
  },
  {
    en: 'Check weather conditions at PFZ',
    hi: 'मत्स्य क्षेत्र (PFZ) पर मौसम की स्थिति जांचें',
    mr: 'मत्स्य क्षेत्रातील हवामान स्थिती तपासा',
  },
  {
    en: 'Safe navigation route to PFZ',
    hi: 'PFZ के लिए सुरक्षित नौवहन मार्ग',
    mr: 'PFZ साठी सुरक्षित सागरी मार्ग',
  },
  {
    en: 'Nearest landing center',
    hi: 'निकटतम लैंडिंग केंद्र/बंदरगाह',
    mr: 'जवळचे लँडिंग केंद्र/बंदर',
  },
  {
    en: 'Weather forecast on recommended route',
    hi: 'अनुशंसित मार्ग पर मौसम पूर्वानुमान',
    mr: 'शिफारस केलेल्या मार्गावरील हवामान अंदाज',
  },
  {
    en: 'Restricted zone details',
    hi: 'प्रतिबंधित क्षेत्र विवरण',
    mr: 'प्रतिबंधित क्षेत्राचा तपशील',
  },
  {
    en: 'Alternative inshore passage',
    hi: 'वैकल्पिक तटीय सुरक्षित जलमार्ग',
    mr: 'पर्यायी किनारपट्टी मार्ग',
  },
  {
    en: 'Active cyclone advisories',
    hi: 'सक्रिय चक्रवात चेतावनी',
    mr: 'सक्रिय चक्रीवादळ चेतावणी',
  },
  {
    en: 'Geofence boundaries near harbor',
    hi: 'बंदरगाह के पास जियोफेंस सीमा',
    mr: 'बंदराजवळील सागरी प्रतिबंधित सीमा',
  },
  {
    en: 'Safe departure window',
    hi: 'सुरक्षित प्रस्थान समय',
    mr: 'सुरक्षित प्रस्थान वेळ',
  },
  {
    en: 'Wave height forecast tomorrow',
    hi: 'कल तरंग ऊंचाई कितनी होगी?',
    mr: 'उद्याच्या लाटांच्या उंचीचा अंदाज',
  },
  {
    en: 'Wind speed and swell period',
    hi: 'हवा की गति और स्वेल अवधि',
    mr: 'वाऱ्याचा वेग आणि उसळीचा कालावधी',
  },
  {
    en: 'Is it safe to depart?',
    hi: 'क्या प्रस्थान करना सुरक्षित है?',
    mr: 'प्रस्थान करणे सुरक्षित आहे का?',
  },
  {
    en: 'Check tomorrow morning forecast',
    hi: 'कल सुबह का मौसम कैसा रहेगा?',
    mr: 'उद्या सकाळचा हवामान अंदाज तपासा',
  },
  {
    en: 'What are the nearest hazards?',
    hi: 'आसपास क्या खतरे हैं?',
    mr: 'जवळचे धोके कोणते आहेत?',
  },
  {
    en: 'Compare passage routes',
    hi: 'सुरक्षित वैकल्पिक मार्ग बताएं',
    mr: 'सागरी मार्गांची तुलना करा',
  },
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

  // Confidence reasons & Warnings
  {
    en: 'Evaluated against M2 mock threshold ceilings',
    hi: 'M2 सिमुलेशन सुरक्षा सीमा थ्रेशोल्ड के आधार पर मूल्यांकित',
    mr: 'M2 सिम्युलेशन सुरक्षा मर्यादा थ्रेशोल्डनुसार मूल्यमापन',
  },
  {
    en: 'M2 Contract Mock evaluation — not for real navigation.',
    hi: 'M2 अनुबंध सिमुलेशन मूल्यांकन — वास्तविक नौवहन के लिए नहीं।',
    mr: 'M2 कॉन्ट्रॅक्ट सिम्युलेशन मूल्यमापन — प्रत्यक्ष सागरी प्रवासासाठी नाही.',
  },
  {
    en: 'M2 Contract Mock evaluation — not for real navigation',
    hi: 'M2 अनुबंध सिमुलेशन मूल्यांकन — वास्तविक नौवहन के लिए नहीं',
    mr: 'M2 कॉन्ट्रॅक्ट सिम्युलेशन मूल्यमापन — प्रत्यक्ष सागरी प्रवासासाठी नाही',
  },
  {
    en: 'Deterministic Dev 4 test double evaluation',
    hi: 'डेव 4 टेस्ट डबल के आधार पर निर्धारित मूल्यांकन',
    mr: 'डेव्ह 4 टेस्ट डबलवर आधारित मूल्यमापन',
  },
  {
    en: 'Recent INCOIS Ocean State Forecast updated 2 hours ago',
    hi: 'नवीनतम INCOIS महासागर पूर्वानुमान 2 घंटे पहले अपडेट किया गया',
    mr: 'ताजा INCOIS सागरी अंदाज २ तासांपूर्वी अपडेट केला गेला',
  },
  {
    en: 'Corroborated by IMD coastal bulletin issued at 18:00 IST',
    hi: '18:00 IST पर जारी IMD तटीय बुलेटिन द्वारा पुष्ट',
    mr: 'संध्याकाळी 18:00 वाजता जारी केलेल्या IMD किनारपट्टी बुलेटिनद्वारे पुष्टी',
  },
  {
    en: 'INCOIS PFZ advisory valid for today',
    hi: 'आज के लिए INCOIS मत्स्य क्षेत्र (PFZ) सलाह वैध',
    mr: 'आजच्या दिवसासाठी INCOIS PFZ सल्ला वैध',
  },
  {
    en: 'Ocean State Forecast corroborates calm conditions',
    hi: 'महासागर पूर्वानुमान शांत और अनुकूल परिस्थितियों की पुष्टि करता है',
    mr: 'सागरी अंदाज शांत आणि अनुकूल परिस्थितीची पुष्टी करतो',
  },
  {
    en: 'Open-Meteo fallback was not needed. Primary data is fresh.',
    hi: 'Open-Meteo बैकअप की आवश्यकता नहीं थी। प्राथमिक डेटा अद्यतित और ताज़ा है।',
    mr: 'Open-Meteo पर्यायाची गरज नव्हती. प्राथमिक डेटा ताजा आणि वैध आहे.',
  },
  {
    en: '[SNAPSHOT] Data sourced from M2 contract mocks — not live.',
    hi: '[SNAPSHOT] M2 अनुबंध सिमुलेशन से लिया गया डेटा — लाइव नहीं।',
    mr: '[SNAPSHOT] M2 सिम्युलेशनवरून घेतलेला डेटा — थेट नाही.',
  },
  {
    en: 'No external evidence required',
    hi: 'किसी बाहरी साक्ष्य की आवश्यकता नहीं है',
    mr: 'कोणत्याही बाह्य पुराव्याची आवश्यकता नाही',
  },
  {
    en: 'Operational baseline verified',
    hi: 'परिचालन आधार रेखा सत्यापित',
    mr: 'सागरी सुरक्षा निकष पडताळले',
  },
  {
    en: 'Active simulated cyclone alert',
    hi: 'सक्रिय सिम्युलेटेड चक्रवात अलर्ट',
    mr: 'सक्रिय सिम्युलेटेड चक्रीवादळ सतर्कता',
  },
  {
    en: 'Simulated PFZ coordinates available',
    hi: 'सिम्युलेटेड मत्स्य क्षेत्र निर्देशांक उपलब्ध',
    mr: 'सिम्युलेटेड PFZ निर्देशांक उपलब्ध',
  },
  {
    en: 'Passage conditions verified',
    hi: 'मार्ग स्थितियां सत्यापित',
    mr: 'सागरी मार्ग परिस्थिती पडताळली',
  },
  {
    en: 'Verify local harbor weather prior to departure (Simulation only).',
    hi: 'प्रस्थान करने से पहले स्थानीय बंदरगाह मौसम की पुष्टि करें (केवल सिमुलेशन)।',
    mr: 'प्रस्थानापूर्वी स्थानिक बंदराचे हवामान तपासा (केवळ सिम्युलेशन).',
  },
  {
    en: 'Depart only with experienced crew and adequate safety gear.',
    hi: 'केवल अनुभवी दल और पर्याप्त सुरक्षा उपकरणों के साथ ही प्रस्थान करें।',
    mr: 'केवळ अनुभवी खलाशी आणि पुरेशी सुरक्षा उपकरणे सोबत घेऊनच जावे.',
  },
  {
    en: 'Elevated wave heights forecast. Exercise caution.',
    hi: 'ऊंची लहरों का पूर्वानुमान है। सावधानी बरतें।',
    mr: 'उंच लाटांचा अंदाज आहे. खबरदारी बाळगा.',
  },
  {
    en: 'Simulated conditions are calm and safe for departure.',
    hi: 'सिम्युलेटेड स्थितियां शांत हैं और प्रस्थान के लिए सुरक्षित हैं।',
    mr: 'सिम्युलेटेड परिस्थिती शांत असून प्रस्थानासाठी सुरक्षित आहे.',
  },
  {
    en: 'Remain moored in port (Simulation only).',
    hi: 'बंदरगाह में ही लंगर डालकर रहें (केवल सिमुलेशन)।',
    mr: 'बंदरातच नांगर टाकून थांबा (केवळ सिम्युलेशन).',
  },
  {
    en: 'Proceed with voyage under standard VHF watch (Simulation only).',
    hi: 'मानक VHF रेडियो संपर्क के तहत यात्रा जारी रखें (केवल सिमुलेशन)।',
    mr: 'प्रमाणित VHF संपर्कात राहून प्रवास सुरू ठेवा (केवळ सिम्युलेशन).',
  },
  {
    en: 'Insufficient or conflicting conditions preclude conclusive assessment.',
    hi: 'अपर्याप्त या परस्पर विरोधी डेटा के कारण निश्चित निष्कर्ष संभव नहीं है।',
    mr: 'अपुऱ्या किंवा विसंगत माहितीमुळे अंतिम निष्कर्ष काढणे शक्य नाही.',
  },
  {
    en: 'Hold departure until authoritative advisory is verified.',
    hi: 'आधिकारिक सलाह सत्यापित होने तक प्रस्थान स्थगित रखें।',
    mr: 'अधिकृत सल्ला पडताळेपर्यंत प्रस्थान थांबवा.',
  },
  {
    en: 'Hold departure.',
    hi: 'प्रस्थान स्थगित रखें।',
    mr: 'प्रस्थान थांबवा.',
  },
  {
    en: 'Operate within 5 nm of coastline.',
    hi: 'तटरेखा से 5 समुद्री मील के भीतर ही संचालन करें।',
    mr: 'किनारपट्टीपासून ५ सागरी मैलाच्या आतच बोट चालवा.',
  },
  {
    en: 'Operate within 5 nm of coastline (Simulation only).',
    hi: 'तटरेखा से 5 समुद्री मील के भीतर ही संचालन करें (केवल सिमुलेशन)।',
    mr: 'किनारपट्टीपासून ५ सागरी मैलाच्या आतच बोट चालवा (केवळ सिम्युलेशन).',
  },
];

const CRAFT_TRANSLATIONS: Record<string, { hi: string; mr: string }> = {
  motorized_boat: { hi: 'मोटराइज्ड नाव', mr: 'मोटार बोट' },
  traditional_non_motorized: { hi: 'पारंपरिक नाव (अमोटराइज्ड)', mr: 'पारंपरिक विना-इंजिन होडी' },
  mechanized_trawler: { hi: 'यंत्रीकृत ट्रॉलर', mr: 'यांत्रिकी ट्रॉलर' },
  trawler: { hi: 'ट्रॉलर', mr: 'ट्रॉलर' },
  boat: { hi: 'नाव/बोट', mr: 'बोट' },
  craft: { hi: 'शिल्प/नाव', mr: 'बोट' },
};

function translateCraft(craft: string, lang: 'hi' | 'mr'): string {
  const clean = craft.trim().toLowerCase();
  return CRAFT_TRANSLATIONS[clean]?.[lang] || craft;
}

interface PatternMatcher {
  pattern: RegExp;
  translate: (match: RegExpMatchArray, lang: 'hi' | 'mr') => string;
}

const DYNAMIC_PATTERNS: PatternMatcher[] = [
  // Moderate wave state (1.6m) requires caution for motorized_boat.
  {
    pattern: /moderate\s+wave\s+state\s*\(([\d.]+)\s*m\)\s*requires\s*caution\s*for\s*([^.]+)\.?/i,
    translate: (m, lang) => {
      const wave = m[1];
      const craft = translateCraft(m[2], lang);
      return lang === 'hi'
        ? `मध्यम समुद्री लहर स्थिति (${wave} मी) के कारण ${craft} के लिए सावधानी आवश्यक है।`
        : `मध्यम सागरी लाट स्थिती (${wave} मी) मुळे ${craft} साठी सावधगिरी बाळगणे आवश्यक आहे.`;
    },
  },
  // Simulated conditions exceed safety ceiling: wave height 3.4m.
  {
    pattern: /simulated\s+conditions\s+exceed\s+safety\s+ceiling:?\s*(?:wave\s+height\s*)?([\d.]+)\s*m\.?/i,
    translate: (m, lang) => {
      const wave = m[1];
      return lang === 'hi'
        ? `सिम्युलेटेड स्थितियां सुरक्षा सीमा से अधिक: लहर ऊंचाई ${wave} मी।`
        : `सिम्युलेटेड परिस्थिती सुरक्षा मर्यादेपेक्षा जास्त: लाटांची उंची ${wave} मी.`;
    },
  },
  // Simulated conditions exceed safety ceiling for motorized_boat.
  {
    pattern: /simulated\s+conditions\s+exceed\s+safety\s+ceiling\s+for\s*([^.]+)\.?/i,
    translate: (m, lang) => {
      const craft = translateCraft(m[1], lang);
      return lang === 'hi'
        ? `सिम्युलेटेड स्थितियां ${craft} के लिए सुरक्षा सीमा से अधिक हैं।`
        : `सिम्युलेटेड परिस्थिती ${craft} साठी सुरक्षा मर्यादेपेक्षा जास्त आहे.`;
    },
  },
  // Simulated conditions require operational caution for motorized_boat.
  {
    pattern: /simulated\s+conditions\s+require\s+operational\s+caution\s+for\s*([^.]+)\.?/i,
    translate: (m, lang) => {
      const craft = translateCraft(m[1], lang);
      return lang === 'hi'
        ? `सिम्युलेटेड स्थितियां ${craft} के लिए परिचालन सावधानी की मांग करती हैं।`
        : `सिम्युलेटेड परिस्थिती ${craft} साठी कार्यशील सावधगिरी बाळगण्यास सांगते.`;
    },
  },
  // Significant wave height: 1.6m or Significant wave height: 2.1 m
  {
    pattern: /significant\s+wave\s+height:?\s*([\d.]+)\s*m/i,
    translate: (m, lang) => {
      const wave = m[1];
      return lang === 'hi' ? `महत्वपूर्ण लहर ऊंचाई: ${wave} मी` : `महत्त्वाची लाट उंची: ${wave} मी`;
    },
  },
  // Sustained wind: 15.0 knots / Wind speed: 18 kn
  {
    pattern: /(?:sustained\s+wind|wind\s+speed):?\s*([\d.]+)\s*(?:knots|kn)/i,
    translate: (m, lang) => {
      const wind = m[1];
      return lang === 'hi' ? `हवा की गति: ${wind} नॉट्स` : `वाऱ्याचा वेग: ${wind} नॉट्स`;
    },
  },
  // Vessel profile: motorized_boat
  {
    pattern: /vessel\s+profile:?\s*([a-zA-Z_]+)/i,
    translate: (m, lang) => {
      const craft = translateCraft(m[1], lang);
      return lang === 'hi' ? `पोत/नाव का प्रकार: ${craft}` : `बोटीचा प्रकार: ${craft}`;
    },
  },
  // Operate within 5 nm of coastline (Simulation only).
  {
    pattern: /operate\s+within\s*([\d.]+)\s*nm\s+of\s+coastline(?:\s*\(simulation\s+only\)\.?)?/i,
    translate: (m, lang) => {
      const dist = m[1];
      return lang === 'hi'
        ? `तटरेखा से ${dist} समुद्री मील के भीतर ही संचालन करें (केवल सिमुलेशन)।`
        : `किनारपट्टीपासून ${dist} सागरी मैलाच्या आतच बोट चालवा (केवळ सिम्युलेशन).`;
    },
  },
  // Passage unsafe due to 3.5m wave height.
  {
    pattern: /passage\s+unsafe\s+due\s+to\s*([\d.]+)\s*m\s+wave\s+height\.?/i,
    translate: (m, lang) => {
      const wave = m[1];
      return lang === 'hi'
        ? `${wave} मी लहर ऊंचाई के कारण समुद्री मार्ग असुरक्षित है।`
        : `${wave} मी लाटांच्या उंचीमुळे सागरी मार्ग असुरक्षित आहे.`;
    },
  },
  // Significant wave height exceeds 3.0m threshold
  {
    pattern: /significant\s+wave\s+height\s+exceeds\s*([\d.]+)\s*m\s+threshold/i,
    translate: (m, lang) => {
      const wave = m[1];
      return lang === 'hi'
        ? `लहर ऊंचाई ${wave} मी की सुरक्षा सीमा से अधिक है`
        : `लाटांची उंची ${wave} मी सुरक्षा मर्यादेपेक्षा जास्त आहे`;
    },
  },
  // Simulated PFZ located 12.4 nm bearing 285° from Ratnagiri.
  {
    pattern: /simulated\s+pfz\s+located\s*([\d.]+)\s*nm\s+bearing\s*([\d°]+)\s+from\s*([a-zA-Z]+)\.?/i,
    translate: (m, lang) => {
      const dist = m[1];
      const bearing = m[2];
      const harbor = m[3] === 'Ratnagiri' ? (lang === 'hi' ? 'रत्नागिरी' : 'रत्नागिरी') : m[3];
      return lang === 'hi'
        ? `सिम्युलेटेड मत्स्य क्षेत्र ${harbor} से ${dist} समुद्री मील (दिशा ${bearing}) पर स्थित है।`
        : `सिम्युलेटेड मत्स्य क्षेत्र ${harbor} वरून ${dist} सागरी मैल (दिशा ${bearing}) अंतरावर आहे.`;
    },
  },
  // Authoritative evaluation status: CAUTION / NO_GO
  {
    pattern: /authoritative\s+evaluation\s+status:?\s*(\w+)/i,
    translate: (m, lang) => {
      const stat = m[1];
      return lang === 'hi' ? `आधिकारिक मूल्यांकन स्थिति: ${stat}` : `अधिकृत मूल्यमापन स्थिती: ${stat}`;
    },
  },
];

/**
 * Normalizes text for lenient phrase matching (ignores case, extra spaces, trailing punctuation).
 */
function normalizeForMatch(str: string): string {
  return str.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?'"॥।]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Translates general text or phrases to target language using canonical dictionary and dynamic pattern matchers.
 */
export function translateText(text: string, targetLang: SupportedLanguage): string {
  if (!text || targetLang === 'en') return text;
  const clean = normalizeForMatch(text);

  // 1. Direct canonical match
  for (const entry of CANONICAL_TRANSLATION_MAP) {
    if (
      normalizeForMatch(entry.en) === clean ||
      normalizeForMatch(entry.hi) === clean ||
      normalizeForMatch(entry.mr) === clean
    ) {
      return entry[targetLang];
    }
  }

  // 2. Dynamic regex pattern matchers
  for (const dm of DYNAMIC_PATTERNS) {
    const match = text.match(dm.pattern);
    if (match) {
      return dm.translate(match, targetLang as 'hi' | 'mr');
    }
  }

  // 3. Fallback lenient substring match
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
 * Translates chat message content, handling multi-line markdown advisories and canonical intents.
 */
export function translateChatMessage(
  content: string,
  targetLang: SupportedLanguage,
  intent?: string
): string {
  if (!content || targetLang === 'en') return content;

  // Intent-directed canonical translation if exact match available
  if (intent) {
    if (intent === 'NEAREST_PFZ' || intent === 'PFZ') {
      const match = CANONICAL_TRANSLATION_MAP.find(e => e.en.includes('Potential Fishing Zone'));
      if (match && (content.includes('Potential Fishing Zone') || content.includes('PFZ'))) {
        return match[targetLang];
      }
    } else if (intent === 'GO_NO_GO_SAFETY') {
      const match = CANONICAL_TRANSLATION_MAP.find(e => e.en.includes('NO-GO'));
      if (match && (content.includes('NO-GO') || content.includes('advised against'))) {
        return match[targetLang];
      }
    } else if (intent === 'HAZARD_BOUNDARY' || intent === 'HAZARDS') {
      const match = CANONICAL_TRANSLATION_MAP.find(e => e.en.includes('hazard alert'));
      if (match && (content.includes('hazard') || content.includes('squall'))) {
        return match[targetLang];
      }
    } else if (intent === 'SAFER_ROUTE' || intent === 'ROUTE') {
      const match = CANONICAL_TRANSLATION_MAP.find(e => e.en.includes('Route Comparison'));
      if (match && (content.includes('Route Comparison') || content.includes('lowest cumulative risk'))) {
        return match[targetLang];
      }
    }
  }

  // Multi-line structured translation
  const lines = content.split('\n');
  const translatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Operational Advisory Header translation
    const advMatch = trimmed.match(/^\[([A-Z_]+)\]\s*(?:Operational\s+Safety\s+Advisory\s+for|Operational\s+Advisory\s+for)\s*([a-zA-Z]+):?$/i);
    if (advMatch) {
      const stat = advMatch[1];
      const harbor = advMatch[2] === 'Ratnagiri' ? 'रत्नागिरी' : advMatch[2];
      return targetLang === 'hi'
        ? `[${stat}] ${harbor} के लिए समुद्री सुरक्षा सलाह:`
        : `[${stat}] ${harbor} साठी सागरी सुरक्षा सल्ला:`;
    }

    // Section headers & inline directives
    if (/^Key Decisive Factors:?$/i.test(trimmed)) {
      return targetLang === 'hi' ? 'प्रमुख निर्णायक कारक:' : 'महत्त्वाचे निर्णायक घटक:';
    }
    const actMatch = trimmed.match(/^(?:Actionable\s+Directive|Recommended\s+Action|Next\s+Action):\s*(.*)$/i);
    if (actMatch) {
      const prefix = targetLang === 'hi' ? 'कार्रवाई निर्देश: ' : 'कृती सल्ला: ';
      return prefix + (actMatch[1] ? translateText(actMatch[1], targetLang) : '');
    }
    const suppMatch = trimmed.match(/^Supporting\s+Evidence:\s*(.*)$/i);
    if (suppMatch) {
      const prefix = targetLang === 'hi' ? 'साक्ष्य आधार: ' : 'पुरावा आधार: ';
      return prefix + (suppMatch[1] ? translateText(suppMatch[1], targetLang) : '');
    }
    const warnMatch = trimmed.match(/^Operational\s+Warnings:\s*(.*)$/i);
    if (warnMatch) {
      const prefix = targetLang === 'hi' ? 'परिचालन चेतावनी: ' : 'परिचालन सूचना: ';
      return prefix + (warnMatch[1] ? translateText(warnMatch[1], targetLang) : '');
    }
    if (/^Notice:\s*Advisory analysis based on authoritative marine and weather observations\.?$/i.test(trimmed)) {
      return targetLang === 'hi'
        ? 'सूचना: यह मूल्यांकन आधिकारिक समुद्री और मौसम डेटा पर आधारित सलाह है।'
        : 'सूचना: हे मूल्यमापन अधिकृत सागरी व हवामान माहितीवर आधारित सल्लागार विश्लेषण आहे.';
    }
    if (/^Notice:\s*This is demonstration data for software verification and is NOT a live fishing advisory\.?$/i.test(trimmed)) {
      return targetLang === 'hi'
        ? 'सूचना: यह सॉफ्टवेयर सत्यापन के लिए प्रदर्शन डेटा है और लाइव मत्स्य पालन सलाह नहीं है।'
        : 'सूचना: हे सॉफ्टवेअर पडताळणीसाठी प्रात्यक्षिक डेटा आहे आणि थेट मासेमारी सल्ला नाही.';
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const prefix = trimmed.slice(0, 2);
      const itemText = trimmed.slice(2);
      return prefix + translateText(itemText, targetLang);
    }

    return translateText(line, targetLang);
  });

  return translatedLines.join('\n');
}

