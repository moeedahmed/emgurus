-- Insert test questions for MRCEM Primary
INSERT INTO public.reviewed_exam_questions (stem, options, correct_answer, explanation, topic, exam, status, reviewed_at) VALUES

-- MRCEM Primary - Cardiology
('TEST QUESTION: A 45-year-old patient presents with chest pain. What is the most common cause of acute myocardial infarction?', 
 '["A. Coronary artery spasm", "B. Atherosclerotic plaque rupture", "C. Coronary embolism", "D. Coronary dissection", "E. Cocaine use"]'::jsonb, 
 'B', 'Atherosclerotic plaque rupture is the most common cause of acute MI, accounting for approximately 70% of cases.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which ECG finding is most characteristic of a STEMI?', 
 '["A. ST depression", "B. T wave inversion", "C. ST elevation >1mm in two contiguous leads", "D. Pathological Q waves", "E. Bundle branch block"]'::jsonb, 
 'C', 'ST elevation >1mm in two contiguous leads is the defining ECG feature of STEMI.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: What is the first-line treatment for stable angina?', 
 '["A. Aspirin only", "B. Beta-blocker and aspirin", "C. ACE inhibitor", "D. Calcium channel blocker", "E. Nitrates"]'::jsonb, 
 'B', 'Beta-blockers and aspirin form the first-line treatment for stable angina.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which arrhythmia is most commonly associated with Wolff-Parkinson-White syndrome?', 
 '["A. Atrial fibrillation", "B. Atrial flutter", "C. AVRT", "D. Ventricular tachycardia", "E. Heart block"]'::jsonb, 
 'C', 'Atrioventricular re-entrant tachycardia (AVRT) is the most common arrhythmia in WPW syndrome.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: What is the target blood pressure for a patient with diabetes?', 
 '["A. <120/80 mmHg", "B. <130/80 mmHg", "C. <140/90 mmHg", "D. <150/90 mmHg", "E. <160/100 mmHg"]'::jsonb, 
 'B', 'Target BP for diabetic patients is <130/80 mmHg according to current guidelines.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which medication should be avoided in patients with heart failure with reduced ejection fraction?', 
 '["A. ACE inhibitors", "B. Beta-blockers", "C. Calcium channel blockers (verapamil)", "D. Diuretics", "E. Aldosterone antagonists"]'::jsonb, 
 'C', 'Negative inotropic calcium channel blockers like verapamil should be avoided in HFrEF.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: What is the most common cause of heart failure in developed countries?', 
 '["A. Hypertension", "B. Ischemic heart disease", "C. Cardiomyopathy", "D. Valvular disease", "E. Congenital heart disease"]'::jsonb, 
 'B', 'Ischemic heart disease is the leading cause of heart failure in developed countries.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which valve abnormality causes a mid-systolic ejection murmur?', 
 '["A. Mitral regurgitation", "B. Mitral stenosis", "C. Aortic stenosis", "D. Aortic regurgitation", "E. Tricuspid regurgitation"]'::jsonb, 
 'C', 'Aortic stenosis causes a mid-systolic ejection murmur best heard at the right sternal border.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: What is the gold standard investigation for pulmonary embolism?', 
 '["A. Chest X-ray", "B. ECG", "C. D-dimer", "D. CT pulmonary angiogram", "E. V/Q scan"]'::jsonb, 
 'D', 'CTPA is the gold standard investigation for diagnosing pulmonary embolism.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which medication is contraindicated in pregnancy for treating hypertension?', 
 '["A. Methyldopa", "B. Labetalol", "C. Nifedipine", "D. ACE inhibitors", "E. Hydralazine"]'::jsonb, 
 'D', 'ACE inhibitors are contraindicated in pregnancy due to teratogenic effects.', 
 'Cardiology', 'MRCEM_Primary', 'approved', now()),

-- MRCEM Primary - Respiratory
('TEST QUESTION: What is the most common cause of community-acquired pneumonia?', 
 '["A. Haemophilus influenzae", "B. Streptococcus pneumoniae", "C. Staphylococcus aureus", "D. Mycoplasma pneumoniae", "E. Legionella pneumophila"]'::jsonb, 
 'B', 'Streptococcus pneumoniae is the most common cause of community-acquired pneumonia.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which investigation is first-line for suspected asthma?', 
 '["A. Chest X-ray", "B. Peak flow monitoring", "C. Spirometry with bronchodilator reversibility", "D. Fractional exhaled nitric oxide", "E. Skin prick tests"]'::jsonb, 
 'C', 'Spirometry with bronchodilator reversibility testing is the first-line investigation for suspected asthma.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: What is the most appropriate first-line treatment for COPD exacerbation?', 
 '["A. Antibiotics only", "B. Prednisolone only", "C. Bronchodilators and prednisolone", "D. Oxygen therapy only", "E. Non-invasive ventilation"]'::jsonb, 
 'C', 'Bronchodilators and oral corticosteroids (prednisolone) are first-line treatment for COPD exacerbations.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which organism most commonly causes hospital-acquired pneumonia?', 
 '["A. Streptococcus pneumoniae", "B. Pseudomonas aeruginosa", "C. Staphylococcus aureus", "D. Klebsiella pneumoniae", "E. E. coli"]'::jsonb, 
 'B', 'Pseudomonas aeruginosa is the most common cause of hospital-acquired pneumonia.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: What is the target oxygen saturation for patients with COPD?', 
 '["A. 88-92%", "B. 94-98%", "C. >95%", "D. >98%", "E. 85-90%"]'::jsonb, 
 'A', 'Target oxygen saturation for COPD patients is 88-92% to avoid CO2 retention.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which medication is first-line for treating pulmonary edema?', 
 '["A. Furosemide", "B. Morphine", "C. GTN", "D. Oxygen", "E. CPAP"]'::jsonb, 
 'A', 'Furosemide (loop diuretic) is the first-line medication for treating pulmonary edema.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: What is the most common cause of spontaneous pneumothorax?', 
 '["A. Trauma", "B. Subpleural blebs", "C. Infection", "D. Malignancy", "E. Connective tissue disease"]'::jsonb, 
 'B', 'Rupture of subpleural blebs is the most common cause of spontaneous pneumothorax.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which finding on chest X-ray is most suggestive of tuberculosis?', 
 '["A. Lower lobe consolidation", "B. Bilateral hilar lymphadenopathy", "C. Upper lobe cavitation", "D. Pleural effusion", "E. Pneumothorax"]'::jsonb, 
 'C', 'Upper lobe cavitation is the classic chest X-ray finding in pulmonary tuberculosis.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: What is the most appropriate initial treatment for severe asthma exacerbation?', 
 '["A. Nebulized salbutamol and ipratropium", "B. Oral prednisolone", "C. IV hydrocortisone", "D. Oxygen therapy", "E. IV magnesium sulfate"]'::jsonb, 
 'A', 'Nebulized bronchodilators (salbutamol and ipratropium) are the initial treatment for severe asthma.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now()),

('TEST QUESTION: Which investigation is most useful for diagnosing pulmonary embolism in pregnancy?', 
 '["A. CT pulmonary angiogram", "B. V/Q scan", "C. D-dimer", "D. Chest X-ray", "E. Echocardiogram"]'::jsonb, 
 'B', 'V/Q scan is preferred over CTPA in pregnancy due to lower radiation exposure to breast tissue.', 
 'Respiratory', 'MRCEM_Primary', 'approved', now());

-- Insert test questions for MRCEM Intermediate SBA
INSERT INTO public.reviewed_exam_questions (stem, options, correct_answer, explanation, topic, exam, status, reviewed_at) VALUES

-- MRCEM SBA - Cardiology
('TEST QUESTION: A 65-year-old presents with acute chest pain and ST elevation in leads II, III, aVF. Which coronary artery is most likely occluded?', 
 '["A. Left anterior descending", "B. Left circumflex", "C. Right coronary artery", "D. Left main stem", "E. Diagonal branch"]'::jsonb, 
 'C', 'Inferior STEMI (leads II, III, aVF) typically indicates right coronary artery occlusion.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate immediate management for a patient with cardiogenic shock post-MI?', 
 '["A. IV fluids", "B. Inotropic support", "C. Emergency PCI", "D. Thrombolysis", "E. IABP insertion"]'::jsonb, 
 'C', 'Emergency PCI is the most appropriate immediate management for cardiogenic shock post-MI.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: Which medication has the strongest evidence for mortality benefit in heart failure with reduced ejection fraction?', 
 '["A. Digoxin", "B. ACE inhibitors", "C. Calcium channel blockers", "D. Diuretics", "E. Nitrates"]'::jsonb, 
 'B', 'ACE inhibitors have the strongest evidence for mortality benefit in HFrEF.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient presents with broad complex tachycardia. Which feature most suggests VT rather than SVT with aberrancy?', 
 '["A. Rate >150 bpm", "B. AV dissociation", "C. Response to vagal maneuvers", "D. Irregular rhythm", "E. Narrow QRS complexes"]'::jsonb, 
 'B', 'AV dissociation is the most reliable feature distinguishing VT from SVT with aberrancy.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most common cause of aortic stenosis in patients over 70?', 
 '["A. Rheumatic heart disease", "B. Bicuspid aortic valve", "C. Degenerative calcification", "D. Infective endocarditis", "E. Congenital stenosis"]'::jsonb, 
 'C', 'Degenerative calcification is the most common cause of aortic stenosis in elderly patients.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: Which arrhythmia is most commonly associated with hyperthyroidism?', 
 '["A. Atrial fibrillation", "B. Ventricular tachycardia", "C. Complete heart block", "D. Sinus bradycardia", "E. Torsades de pointes"]'::jsonb, 
 'A', 'Atrial fibrillation is the most common arrhythmia associated with hyperthyroidism.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate management for a patient with acute pericarditis?', 
 '["A. Aspirin and colchicine", "B. Prednisolone", "C. Antibiotics", "D. Pericardiocentesis", "E. Cardiac catheterization"]'::jsonb, 
 'A', 'Aspirin and colchicine are first-line treatment for acute pericarditis.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: Which investigation is most appropriate for assessing left ventricular function?', 
 '["A. ECG", "B. Chest X-ray", "C. Echocardiogram", "D. Coronary angiography", "E. Exercise stress test"]'::jsonb, 
 'C', 'Echocardiography is the most appropriate investigation for assessing left ventricular function.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the target INR for a patient with atrial fibrillation on warfarin?', 
 '["A. 1.5-2.0", "B. 2.0-3.0", "C. 2.5-3.5", "D. 3.0-4.0", "E. 1.0-2.0"]'::jsonb, 
 'B', 'Target INR for atrial fibrillation anticoagulation is 2.0-3.0.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: Which factor most increases the risk of stroke in atrial fibrillation?', 
 '["A. Male gender", "B. Age >65 years", "C. Hypertension", "D. Previous stroke/TIA", "E. Heart failure"]'::jsonb, 
 'D', 'Previous stroke or TIA is the highest risk factor for stroke in atrial fibrillation.', 
 'Cardiology', 'MRCEM_SBA', 'approved', now()),

-- MRCEM SBA - Emergency Medicine
('TEST QUESTION: A 25-year-old presents with sudden onset severe headache. What is the most appropriate initial investigation?', 
 '["A. MRI brain", "B. CT head", "C. Lumbar puncture", "D. CT angiography", "E. Carotid ultrasound"]'::jsonb, 
 'B', 'CT head is the most appropriate initial investigation for sudden severe headache to exclude SAH.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most common cause of altered mental state in the elderly emergency department patient?', 
 '["A. Stroke", "B. Infection", "C. Medication toxicity", "D. Hypoglycemia", "E. Dehydration"]'::jsonb, 
 'B', 'Infection (particularly UTI and pneumonia) is the most common cause of altered mental state in elderly ED patients.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient presents with suspected sepsis. What is the target time for antibiotic administration?', 
 '["A. Within 30 minutes", "B. Within 1 hour", "C. Within 3 hours", "D. Within 6 hours", "E. Within 24 hours"]'::jsonb, 
 'B', 'Antibiotics should be administered within 1 hour of recognition of sepsis (Surviving Sepsis Guidelines).', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate fluid for initial resuscitation in septic shock?', 
 '["A. Normal saline", "B. Hartmanns solution", "C. 5% dextrose", "D. Albumin", "E. Gelofusine"]'::jsonb, 
 'B', 'Balanced crystalloids like Hartmanns solution are preferred for initial sepsis resuscitation.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient has a GCS of 8. What is the most appropriate immediate management?', 
 '["A. Intubation", "B. CT head", "C. IV fluids", "D. Neurological assessment", "E. Blood glucose check"]'::jsonb, 
 'A', 'GCS ≤8 is an indication for intubation to protect the airway.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most common cause of sudden cardiac death in young athletes?', 
 '["A. Coronary artery disease", "B. Hypertrophic cardiomyopathy", "C. Long QT syndrome", "D. Arrhythmogenic right ventricular cardiomyopathy", "E. Commotio cordis"]'::jsonb, 
 'B', 'Hypertrophic cardiomyopathy is the most common cause of sudden cardiac death in young athletes.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient presents with suspected anaphylaxis. What is the most appropriate immediate treatment?', 
 '["A. IV hydrocortisone", "B. IM adrenaline", "C. IV chlorphenamine", "D. Nebulized salbutamol", "E. IV fluids"]'::jsonb, 
 'B', 'IM adrenaline is the most appropriate immediate treatment for anaphylaxis.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate management for a patient with major trauma and hypotension?', 
 '["A. IV crystalloids", "B. Blood transfusion", "C. Massive transfusion protocol", "D. Vasopressors", "E. Surgical intervention"]'::jsonb, 
 'C', 'Massive transfusion protocol should be activated for major trauma with hypotension.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient presents with acute stroke symptoms. What is the time window for thrombolysis?', 
 '["A. 2 hours", "B. 3 hours", "C. 4.5 hours", "D. 6 hours", "E. 8 hours"]'::jsonb, 
 'C', 'The time window for thrombolysis in acute stroke is 4.5 hours from symptom onset.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate initial pain relief for suspected renal colic?', 
 '["A. Paracetamol", "B. Morphine", "C. Diclofenac", "D. Tramadol", "E. Codeine"]'::jsonb, 
 'C', 'NSAIDs like diclofenac are first-line analgesia for renal colic pain.', 
 'Emergency Medicine', 'MRCEM_SBA', 'approved', now());

-- Insert test questions for FRCEM SBA
INSERT INTO public.reviewed_exam_questions (stem, options, correct_answer, explanation, topic, exam, status, reviewed_at) VALUES

-- FRCEM SBA - Critical Care
('TEST QUESTION: A ventilated patient develops high airway pressures and reduced compliance. What is the most likely cause?', 
 '["A. Pneumothorax", "B. Bronchospasm", "C. Equipment malfunction", "D. Patient fighting ventilator", "E. Pulmonary edema"]'::jsonb, 
 'A', 'Pneumothorax is the most concerning cause of acute high airway pressures in ventilated patients.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate sedation target for a mechanically ventilated ICU patient?', 
 '["A. RASS -5", "B. RASS -3", "C. RASS -1 to 0", "D. RASS +1", "E. No sedation"]'::jsonb, 
 'C', 'Light sedation (RASS -1 to 0) is associated with better outcomes in mechanically ventilated patients.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient with ARDS requires mechanical ventilation. What is the target tidal volume?', 
 '["A. 4-6 ml/kg IBW", "B. 6-8 ml/kg IBW", "C. 8-10 ml/kg IBW", "D. 10-12 ml/kg IBW", "E. 12-15 ml/kg IBW"]'::jsonb, 
 'B', 'Lung-protective ventilation in ARDS uses tidal volumes of 6-8 ml/kg ideal body weight.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate vasopressor for septic shock?', 
 '["A. Dopamine", "B. Dobutamine", "C. Noradrenaline", "D. Adrenaline", "E. Vasopressin"]'::jsonb, 
 'C', 'Noradrenaline is the first-line vasopressor for septic shock according to guidelines.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient develops acute kidney injury on ICU. What is the most appropriate renal replacement therapy?', 
 '["A. Hemodialysis", "B. Peritoneal dialysis", "C. CVVHDF", "D. Hemofiltration", "E. Plasmapheresis"]'::jsonb, 
 'C', 'Continuous venovenous hemodiafiltration (CVVHDF) is preferred for critically ill patients with AKI.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate glucose target for critically ill patients?', 
 '["A. 4-6 mmol/L", "B. 6-8 mmol/L", "C. 8-10 mmol/L", "D. 10-12 mmol/L", "E. <4 mmol/L"]'::jsonb, 
 'B', 'Target blood glucose for critically ill patients is 6-8 mmol/L to avoid hypoglycemia.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient develops ventilator-associated pneumonia. What is the most appropriate antibiotic choice?', 
 '["A. Amoxicillin", "B. Cefuroxime", "C. Piperacillin-tazobactam", "D. Gentamicin", "E. Flucloxacillin"]'::jsonb, 
 'C', 'Broad-spectrum antibiotics like piperacillin-tazobactam are appropriate for VAP coverage.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate method for preventing VAP?', 
 '["A. Daily sedation breaks", "B. Head elevation 30-45 degrees", "C. Prophylactic antibiotics", "D. Sterile suctioning", "E. Frequent ventilator circuit changes"]'::jsonb, 
 'B', 'Head elevation 30-45 degrees is a key VAP prevention strategy.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient on ICU develops delirium. What is the most appropriate initial management?', 
 '["A. Haloperidol", "B. Midazolam", "C. Non-pharmacological interventions", "D. Quetiapine", "E. Lorazepam"]'::jsonb, 
 'C', 'Non-pharmacological interventions should be tried first for ICU delirium management.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate hemoglobin target for critically ill patients?', 
 '["A. >100 g/L", "B. >90 g/L", "C. >80 g/L", "D. >70 g/L", "E. >60 g/L"]'::jsonb, 
 'D', 'Restrictive transfusion strategy with Hb target >70 g/L is recommended for most critically ill patients.', 
 'Critical Care', 'FRCEM_SBA', 'approved', now()),

-- FRCEM SBA - Trauma
('TEST QUESTION: A patient with major trauma has a systolic BP of 80 mmHg. What is the minimum acceptable systolic BP target?', 
 '["A. 80 mmHg", "B. 90 mmHg", "C. 100 mmHg", "D. 110 mmHg", "E. 120 mmHg"]'::jsonb, 
 'B', 'Minimum systolic BP target in major trauma is 90 mmHg to maintain organ perfusion.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient has a penetrating chest wound with shock. What is the most appropriate immediate management?', 
 '["A. Chest drain insertion", "B. Emergency thoracotomy", "C. IV access and fluids", "D. Intubation", "E. Blood transfusion"]'::jsonb, 
 'B', 'Emergency thoracotomy may be indicated for penetrating chest trauma with shock.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most common cause of preventable death in major trauma?', 
 '["A. Airway obstruction", "B. Tension pneumothorax", "C. Hemorrhage", "D. Head injury", "E. Fat embolism"]'::jsonb, 
 'C', 'Uncontrolled hemorrhage is the most common cause of preventable death in major trauma.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient has suspected traumatic brain injury with GCS 12. What is the most appropriate initial investigation?', 
 '["A. MRI brain", "B. CT head", "C. Skull X-ray", "D. Cervical spine X-ray", "E. CT angiography"]'::jsonb, 
 'B', 'CT head is the initial investigation of choice for suspected traumatic brain injury.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate fluid for trauma resuscitation?', 
 '["A. Normal saline", "B. Hartmanns solution", "C. Blood products", "D. Albumin", "E. Dextrose saline"]'::jsonb, 
 'C', 'Blood products are preferred for trauma resuscitation to replace blood loss.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient has a pelvic fracture with hemodynamic instability. What is the most appropriate immediate management?', 
 '["A. Pelvic binder", "B. External fixation", "C. Angiography and embolization", "D. Surgery", "E. Blood transfusion"]'::jsonb, 
 'A', 'Pelvic binder should be applied immediately for unstable pelvic fractures with hemorrhage.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most appropriate target for permissive hypotension in penetrating trauma?', 
 '["A. SBP 70-80 mmHg", "B. SBP 80-90 mmHg", "C. SBP 90-100 mmHg", "D. SBP 100-110 mmHg", "E. Normal BP"]'::jsonb, 
 'B', 'Permissive hypotension target in penetrating trauma is typically SBP 80-90 mmHg.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A patient has suspected spinal injury. What is the most appropriate immobilization?', 
 '["A. Cervical collar only", "B. Full spinal board", "C. Vacuum mattress", "D. Log roll technique", "E. Manual inline stabilization"]'::jsonb, 
 'C', 'Vacuum mattress provides better comfort and immobilization than traditional spinal boards.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: What is the most common site of missed injury in trauma patients?', 
 '["A. Cervical spine", "B. Extremities", "C. Abdomen", "D. Chest", "E. Head"]'::jsonb, 
 'B', 'Extremity injuries are the most commonly missed injuries in trauma patients.', 
 'Trauma', 'FRCEM_SBA', 'approved', now()),

('TEST QUESTION: A trauma patient requires emergency surgery but refuses blood transfusion. What is the most appropriate management?', 
 '["A. Proceed without transfusion", "B. Seek court order", "C. Use blood substitutes", "D. Wait for next of kin consent", "E. Discharge patient"]'::jsonb, 
 'A', 'If patient has capacity and refuses transfusion, their autonomous decision must be respected.', 
 'Trauma', 'FRCEM_SBA', 'approved', now());