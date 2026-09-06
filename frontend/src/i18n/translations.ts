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
  disclaimerText: string;
  prompts: PromptTemplate[];
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
    disclaimerText: '⚠️ Prototype only — not an operational marine-navigation or life-safety system',
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
    disclaimerText: '⚠️ केवल प्रोटोटाइप — वास्तविक नौवहन या जीवन सुरक्षा प्रणाली नहीं',
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
    disclaimerText: '⚠️ केवळ प्रोटोटाइप — प्रत्यक्ष सागरी दिशादर्शन किंवा जीवरक्षक प्रणाली नाही',
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
  },
};
