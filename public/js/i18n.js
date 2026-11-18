// CareTime Bilingual UI Dictionary (English & Bengali)
const translations = {
  en: {
    app_title: "CareTime",
    app_subtitle: "Outpatient Queue & Digital Health Record Platform",
    tagline: "Clear wait times, smooth clinic visits, zero crowded waiting rooms.",
    
    // Auth & Navigation
    nav_home: "Home",
    nav_patient: "Patient Portal",
    nav_assistant: "Assistant Console",
    nav_doctor: "Doctor Cockpit",
    login_title: "Patient & Staff Login",
    login_subtitle: "Enter your registered mobile phone number to continue.",
    phone_label: "Mobile Number",
    phone_placeholder: "e.g. 01711223344",
    otp_label: "4-Digit Verification Code (OTP)",
    otp_placeholder: "Enter 1234 (Dev mode)",
    btn_login: "Sign In Securely",
    demo_bar_title: "Quick Role Testing (One-Click Instant Login)",
    demo_patient: "Enter as Demo Patient",
    demo_assistant: "Enter as Clinic Assistant",
    demo_doctor: "Enter as Doctor",
    btn_logout: "Sign Out",

    // Patient Portal
    patient_header: "Patient Live Queue & Health Records",
    phid_label: "PHID",
    now_serving: "Now Serving",
    your_token: "Your Token",
    est_wait: "Estimated Wait Time",
    mins_unit: "mins",
    approx: "~",
    queue_empty: "No patients waiting currently.",
    chamber_status: "Inside Doctor's Chamber",
    waiting_ahead: "patient(s) ahead of you",
    book_token_title: "Book Clinic Serial Token",
    visit_type_label: "Visit Reason",
    visit_new: "New Checkup",
    visit_followup: "Follow-up",
    visit_report: "Report Show",
    btn_book_token: "Confirm & Get Serial Token",
    upload_report_title: "Digitize Diagnostic Report (AI OCR)",
    upload_report_sub: "Upload phone photos or PDF lab slips for instant biomarker extraction.",
    report_title_label: "Report Title / Lab Name",
    report_file_label: "Select Document or Photo",
    btn_upload_report: "Upload & Extract Biomarkers",
    extracting_notice: "AI is scanning and normalizing biomarkers...",
    past_records_title: "Past Digital Health Records & Prescriptions",
    no_records_yet: "No digitized reports uploaded yet.",
    no_prescriptions_yet: "No past prescriptions recorded.",

    // Alerts
    alert_45_heading: "Time to Depart for Clinic",
    alert_10_heading: "Please Step into Waiting Area",
    
    // Assistant Console
    assistant_title: "Clinic Assistant Operations Console",
    assistant_subtitle: "Fast, error-free token management for reception & compounders.",
    session_doctor: "Consulting Doctor",
    current_pace: "Current Pace",
    pace_unit: "mins/patient",
    btn_call_next: "CALL NEXT PATIENT",
    btn_complete: "MARK CONSULTATION COMPLETE",
    btn_add_delay: "+15 MIN DOCTOR DELAY",
    table_serial: "Token #",
    table_patient: "Patient Name",
    table_type: "Visit Type",
    table_eta: "Predicted Wait",
    table_priority: "Priority Action",
    btn_emergency: "EMERGENCY BUMP",
    emergency_tag: "EMERGENCY PRIORITY",

    // Doctor Cockpit
    doctor_title: "Doctor Clinical Cockpit",
    active_patient_label: "Current Patient in Chamber",
    clinical_brief_heading: "3-Line AI Clinical Brief",
    trends_heading: "Longitudinal Biomarker History (Trends)",
    digitized_labs_heading: "Recent Extracted Lab Results",
    test_name: "Test Name",
    observed_val: "Observed Value",
    ref_range: "Normal Range",
    status_label: "Clinical Flag",
    prescription_heading: "Digital Prescription Pad",
    allergy_warning_title: "SAFETY ALERT: KNOWN ALLERGY DETECTED",
    diagnosis_label: "Provisional Diagnosis",
    diagnosis_placeholder: "e.g. Type 2 Diabetes with Poor Glycemic Control",
    medicines_label: "Prescribed Medicines",
    med_name_placeholder: "Medicine Name (e.g. Metformin)",
    med_dose_placeholder: "Dosage (e.g. 1+0+1)",
    med_dur_placeholder: "Duration (e.g. 30 days)",
    btn_add_med: "+ Add Another Medicine",
    advice_label: "Dietary & Lifestyle Advice",
    advice_placeholder: "e.g. 30 mins morning walk, low salt and carbohydrates.",
    btn_save_rx: "Save Prescription & Complete Visit"
  },

  bn: {
    app_title: "কেয়ারটাইম",
    app_subtitle: "বহির্বিভাগ সিরিয়াল ও ডিজিটাল স্বাস্থ্যসেবা প্ল্যাটফর্ম",
    tagline: "সঠিক অপেক্ষার সময়, ঝামেলাহীন সিরিয়াল, অতিরিক্ত ভিড়মুক্ত ক্লিনিক।",

    // Auth & Navigation
    nav_home: "মূল পাতা",
    nav_patient: "রোগীর পোর্টাল",
    nav_assistant: "সহকারী কনসোল",
    nav_doctor: "চিকিৎসক কর্নার",
    login_title: "রোগী ও কর্মীদের লগইন",
    login_subtitle: "চালিয়ে যেতে আপনার নিবন্ধিত মোবাইল নম্বর প্রবেশ করান।",
    phone_label: "মোবাইল নম্বর",
    phone_placeholder: "যেমন: 01711223344",
    otp_label: "৪-সংখ্যার ওটিপি কোড",
    otp_placeholder: "লিখুন 1234 (টেস্ট মোড)",
    btn_login: "নিরাপদে প্রবেশ করুন",
    demo_bar_title: "এক ক্লিকে তাৎক্ষণিক ডেমো লগইন",
    demo_patient: "ডেমো রোগী হিসেবে প্রবেশ",
    demo_assistant: "ক্লিনিক সহকারী হিসেবে প্রবেশ",
    demo_doctor: "চিকিৎসক হিসেবে প্রবেশ",
    btn_logout: "লগআউট",

    // Patient Portal
    patient_header: "লাইভ সিরিয়াল ও স্বাস্থ্য রেকর্ড",
    phid_label: "স্বাস্থ্য আইডি (PHID)",
    now_serving: "চলমান সিরিয়াল",
    your_token: "আপনার সিরিয়াল",
    est_wait: "আনুমানিক অপেক্ষার সময়",
    mins_unit: "মিনিট",
    approx: "প্রায়",
    queue_empty: "বর্তমানে অপেক্ষমাণ কোনো রোগী নেই।",
    chamber_status: "ডাক্তারের চেম্বারে উপস্থিত",
    waiting_ahead: "জন রোগী আপনার আগে অপেক্ষমাণ",
    book_token_title: "নতুন সিরিয়াল টোকেন গ্রহণ করুন",
    visit_type_label: "পরিদর্শনের ধরন",
    visit_new: "নতুন রোগী",
    visit_followup: "পুনরায় পরিদর্শন",
    visit_report: "রিপোর্ট প্রদর্শন",
    btn_book_token: "সিরিয়াল নিশ্চিত করুন",
    upload_report_title: "ল্যাব রিপোর্ট ডিজিটাইজ করুন (AI OCR)",
    upload_report_sub: "মোবাইলে তোলা ছবি বা পিডিএফ স্লিপ আপলোড করে বায়োমার্কার আলাদা করুন।",
    report_title_label: "রিপোর্টের নাম / ল্যাব",
    report_file_label: "ডকুমেন্ট বা ছবি নির্বাচন করুন",
    btn_upload_report: "আপলোড ও রিপোর্ট বিশ্লেষণ",
    extracting_notice: "কৃত্রিম বুদ্ধিমত্তা ল্যাব রিপোর্ট বিশ্লেষণ করছে...",
    past_records_title: "পূর্ববর্তী ডিজিটাল রেকর্ড ও প্রেসক্রিপশন",
    no_records_yet: "এখনও কোনো রিপোর্ট আপলোড করা হয়নি।",
    no_prescriptions_yet: "পূর্বে কোনো প্রেসক্রিপশন জমা নেই।",

    // Alerts
    alert_45_heading: "ক্লিনিকের উদ্দেশ্যে রওনা হওয়ার সময় হয়েছে",
    alert_10_heading: "অনুগ্রহ করে এখন ওয়েটিং এরিয়ায় আসুন",

    // Assistant Console
    assistant_title: "সহকারী অপারেশন কনসোল",
    assistant_subtitle: "রিসেপশনিস্ট ও সহকারী কর্মীদের জন্য নির্ভুল সিরিয়াল নিয়ন্ত্রণ।",
    session_doctor: "দায়িত্বপ্রাপ্ত চিকিৎসক",
    current_pace: "বর্তমান গতি",
    pace_unit: "মিনিট/রোগী",
    btn_call_next: "পরবর্তী রোগীকে ডাকুন",
    btn_complete: "পরামর্শ সম্পন্ন চিহ্নিত করুন",
    btn_add_delay: "+১৫ মিনিট বিলম্ব যোগ করুন",
    table_serial: "সিরিয়াল নং",
    table_patient: "রোগীর নাম",
    table_type: "রোগীর ধরন",
    table_eta: "সম্ভাব্য অপেক্ষা",
    table_priority: "জরুরি পদক্ষেপ",
    btn_emergency: "জরুরি অগ্রাধিকার দিন",
    emergency_tag: "জরুরি রোগী",

    // Doctor Cockpit
    doctor_title: "চিকিৎসক ক্লিনিক্যাল ককপিট",
    active_patient_label: "বর্তমানে চেম্বারে উপস্থিত রোগী",
    clinical_brief_heading: "৩-লাইনের এআই ক্লিনিক্যাল সারসংক্ষেপ",
    trends_heading: "বায়োমার্কারের ধারাবাহিক পরিবর্তন (গ্রাফ)",
    digitized_labs_heading: "সাম্প্রতিক ল্যাব টেস্ট ফলাফল",
    test_name: "পরীক্ষার নাম",
    observed_val: "ফলাফল",
    ref_range: "স্বাভাবিক মাত্রা",
    status_label: "ফলাফলের অবস্থা",
    prescription_heading: "ডিজিটাল প্রেসক্রিপশন প্যাড",
    allergy_warning_title: "নিরাপত্তা সতর্কতা: অ্যালার্জিযুক্ত ওষুধ শনাক্ত হয়েছে",
    diagnosis_label: "প্রাথমিক রোগ নির্ণয়",
    diagnosis_placeholder: "যেমন: টাইপ ২ ডায়াবেটিস ও উচ্চ রক্তচাপ",
    medicines_label: "নির্ধারিত ওষুধসমূহ",
    med_name_placeholder: "ওষুধের নাম (যেমন: মেটফরমিন)",
    med_dose_placeholder: "মাত্রা (যেমন: ১+০+১)",
    med_dur_placeholder: "মেয়াদ (যেমন: ৩০ দিন)",
    btn_add_med: "+ আরও একটি ওষুধ যোগ করুন",
    advice_label: "জীবনযাত্রা ও খাদ্যাভ্যাসের পরামর্শ",
    advice_placeholder: "যেমন: প্রতিদিন ৩০ মিনিট হাঁটা, কম লবণ ও মিষ্টি পরিহার।",
    btn_save_rx: "প্রেসক্রিপশন সংরক্ষণ ও ভিজিট সম্পন্ন করুন"
  }
};

let currentLang = localStorage.getItem('caretime_lang') || 'en';

function getTranslation(key) {
  if (translations[currentLang] && translations[currentLang][key]) {
    return translations[currentLang][key];
  }
  return translations['en'][key] || key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('caretime_lang', lang);
  applyTranslations();
  const toggleBtn = document.getElementById('langToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = lang === 'en' ? 'বাংলা' : 'English';
  }
}

function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'bn' : 'en');
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = getTranslation(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.getAttribute('placeholder')) {
        el.setAttribute('placeholder', val);
      }
    } else {
      el.textContent = val;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', getTranslation(key));
  });
}

// Initial setup on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('langToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = currentLang === 'en' ? 'বাংলা' : 'English';
    toggleBtn.addEventListener('click', toggleLanguage);
  }
  applyTranslations();
});
