/**
 * Eligibility Engine v2
 * 
 * This engine uses the ACTUAL `required_fields` from each service record
 * to dynamically determine what questions to ask. It compares what we
 * already know from the user's eGov profile against what each program needs.
 * 
 * Flow:
 * 1. Fetch services for the category
 * 2. Collect ALL required_fields across those services
 * 3. Subtract what we already know from the user's profile
 * 4. Generate questions ONLY for the missing fields
 * 5. After answers, score eligibility using profile + answers + eligibility rules
 */

// ─── Field Definitions ───────────────────────────────────────────────────────
// Maps field IDs (from services.required_fields) to question definitions

const FIELD_QUESTIONS = {
  age: {
    question: 'How old are you?',
    type: 'computed', // auto-computed from birth_date
  },
  nationality: {
    question: 'What is your citizenship?',
    type: 'computed', // from profile
  },
  income: {
    question: 'What is your household\'s estimated monthly income?',
    type: 'select',
    options: ['Below ₱10,000', '₱10,001 – ₱20,000', '₱20,001 – ₱40,000', '₱40,001 – ₱80,000', 'Above ₱80,000'],
  },
  household_income: {
    question: 'What is your household\'s estimated monthly income?',
    type: 'select',
    options: ['Below ₱10,000', '₱10,001 – ₱20,000', '₱20,001 – ₱40,000', '₱40,001 – ₱80,000', 'Above ₱80,000'],
  },
  employment_status: {
    question: 'What is your current employment status?',
    type: 'select',
    options: ['Employed (private sector)', 'Employed (government)', 'Self-employed', 'Unemployed', 'Underemployed', 'Seasonal/Contractual worker', 'Student', 'Retired'],
  },
  education_level: {
    question: 'What is your highest educational attainment?',
    type: 'select',
    options: ['Elementary', 'High School', 'Senior High School', 'Vocational/Technical', 'College (ongoing)', 'College Graduate', 'Post-Graduate'],
  },
  school_type: {
    question: 'What type of school are you attending or plan to attend?',
    type: 'select',
    options: ['State University/College (SUC/LUC)', 'Private University/College', 'Technical-Vocational (TESDA)', 'Not currently in school'],
  },
  enrollment_status: {
    question: 'What is your current enrollment status?',
    type: 'select',
    options: ['Currently enrolled', 'Incoming freshman/transferee', 'Planning to enroll next semester', 'Not enrolled / Graduated', 'Out-of-school youth'],
  },
  region: {
    question: 'Which region do you live in?',
    type: 'computed', // from profile
  },
  disability_status: {
    question: 'Do you have a disability?',
    type: 'select',
    options: ['No disability', 'Physical disability', 'Visual impairment', 'Hearing impairment', 'Intellectual disability', 'Psychosocial disability', 'Multiple disabilities'],
  },
  disability_type: {
    question: 'What type of disability do you have?',
    type: 'select',
    options: ['Physical', 'Visual', 'Hearing', 'Intellectual', 'Psychosocial', 'Learning disability', 'Multiple disabilities', 'No disability'],
  },
  philhealth_status: {
    question: 'Are you a PhilHealth member?',
    type: 'select',
    options: ['Yes, active member', 'Yes, but inactive/expired', 'No, not a member'],
  },
  health_condition: {
    question: 'Do you have any current health condition requiring treatment?',
    type: 'select',
    options: ['None / Healthy', 'Chronic illness (diabetes, hypertension, etc.)', 'Serious/critical illness (cancer, kidney disease, etc.)', 'Recent hospitalization', 'Pregnancy-related'],
  },
  housing_status: {
    question: 'What is your current housing situation?',
    type: 'select',
    options: ['Own home (fully paid)', 'Own home (with mortgage)', 'Renting', 'Living with relatives', 'Informal settler', 'No permanent residence'],
  },
  existing_property: {
    question: 'Do you currently own any residential property?',
    type: 'radio',
    options: ['Yes', 'No'],
  },
  business_type: {
    question: 'Do you have or plan to start a business?',
    type: 'select',
    options: ['No business', 'Planning to start', 'Micro-enterprise (below ₱3M assets)', 'Small enterprise (₱3M–₱15M)', 'Medium enterprise (₱15M–₱100M)'],
  },
  business_registration: {
    question: 'Is your business registered with DTI/SEC?',
    type: 'radio',
    options: ['Yes, registered', 'No, not yet registered', 'Not applicable'],
  },
  years_in_business: {
    question: 'How long has your business been operating?',
    type: 'select',
    options: ['Not yet started', 'Less than 1 year', '1–3 years', '3–5 years', 'More than 5 years', 'Not applicable'],
  },
  occupation: {
    question: 'What is your current occupation?',
    type: 'computed', // from profile
  },
  farm_size: {
    question: 'What is the size of your agricultural land?',
    type: 'select',
    options: ['No farmland', 'Less than 1 hectare', '1–3 hectares', '3–5 hectares', 'More than 5 hectares'],
  },
  crop_type: {
    question: 'What do you primarily farm or produce?',
    type: 'select',
    options: ['Rice', 'Corn', 'Vegetables', 'Fruits', 'Livestock/Poultry', 'Fisheries/Aquaculture', 'Mixed farming', 'Not applicable'],
  },
  disaster_affected: {
    question: 'Have you been affected by a recent disaster or calamity?',
    type: 'select',
    options: ['Yes, within the last 3 months', 'Yes, within the last year', 'No, not recently affected'],
  },
  pagibig_membership: {
    question: 'Are you a Pag-IBIG Fund member?',
    type: 'radio',
    options: ['Yes, active member', 'Yes, but inactive', 'No'],
  },
  pagibig_contributions: {
    question: 'How many monthly Pag-IBIG contributions do you have?',
    type: 'select',
    options: ['Less than 24 months', '24 months or more', 'Not sure', 'Not a member'],
  },
  sss_membership: {
    question: 'Are you an SSS member?',
    type: 'radio',
    options: ['Yes, active', 'Yes, but not contributing currently', 'No'],
  },
  parental_status: {
    question: 'Are you a solo parent?',
    type: 'radio',
    options: ['Yes', 'No'],
  },
  children_ages: {
    question: 'Do you have children below 18 years old?',
    type: 'radio',
    options: ['Yes', 'No'],
  },
  household_size: {
    question: 'How many people are in your household?',
    type: 'select',
    options: ['1 (just me)', '2–3', '4–5', '6–8', 'More than 8'],
  },
  pregnancy_status: {
    question: 'Are you currently pregnant?',
    type: 'radio',
    options: ['Yes', 'No', 'Not applicable'],
  },
  gwa: {
    question: 'What is your General Weighted Average (GWA) or equivalent?',
    type: 'select',
    options: ['95% and above', '90–94%', '85–89%', '80–84%', 'Below 80%', 'Not applicable'],
  },
  separation_reason: {
    question: 'Were you involuntarily separated from your last job?',
    type: 'select',
    options: ['Yes, due to retrenchment/closure', 'Yes, due to redundancy', 'Yes, due to disaster/calamity', 'No, I resigned voluntarily', 'Not applicable'],
  },
  cooperative_membership: {
    question: 'Are you a member of a registered cooperative or farmers\' association?',
    type: 'radio',
    options: ['Yes', 'No'],
  },
};

// Fields that are automatically resolved from the user's profile (no question needed)
const AUTO_RESOLVED_FIELDS = new Set([
  'age', 'nationality', 'region', 'occupation', 'sex',
]);

// ─── Profile Field Extractors ─────────────────────────────────────────────────

function extractKnownFields(userContext) {
  const known = {};

  if (userContext.birth_date) {
    known.age = calculateAge(userContext.birth_date);
    known.birth_date = userContext.birth_date;
  }

  if (userContext.gender) known.gender = userContext.gender.toLowerCase();
  if (userContext.nationality) known.nationality = userContext.nationality;
  if (userContext.civil_status) known.civil_status = userContext.civil_status;
  if (userContext.region) known.region = userContext.region;
  if (userContext.province) known.province = userContext.province;
  if (userContext.municipality) known.municipality = userContext.municipality;
  if (userContext.occupation) known.occupation = userContext.occupation;
  if (userContext.industry) known.industry = userContext.industry;
  if (userContext.salary_range) {
    known.salary_range = userContext.salary_range;
    known.income = userContext.salary_range;
    known.household_income = userContext.salary_range;
  }
  if (userContext.education) {
    known.education = userContext.education;
    known.education_level = userContext.education;
  }
  if (userContext.email) known.email = userContext.email;

  return known;
}

function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ─── Dynamic Question Generator ──────────────────────────────────────────────
/**
 * Analyzes all services for a category, collects their required_fields,
 * and generates questions ONLY for fields not already in the user's profile.
 * 
 * Also returns which programs need each field (for the "Needed to check: X, Y" chips)
 */
function generateDynamicQuestions(services, knownFields) {
  // Collect all required_fields across services, tracking which programs need each
  const fieldToPrograms = {};

  for (const service of services) {
    const requiredFields = Array.isArray(service.required_fields) ? service.required_fields : [];
    for (const field of requiredFields) {
      if (!fieldToPrograms[field]) fieldToPrograms[field] = [];
      fieldToPrograms[field].push(service.title);
    }
  }

  // Filter: only ask about fields we DON'T already know and that have questions defined
  const questions = [];
  const askedFields = new Set();

  for (const [field, programNames] of Object.entries(fieldToPrograms)) {
    // Skip if auto-resolved from profile
    if (AUTO_RESOLVED_FIELDS.has(field) && knownFields[field] !== undefined) continue;

    // Skip if we already have this data
    if (knownFields[field] !== undefined) continue;

    // Skip duplicates (income/household_income are the same)
    if (field === 'household_income' && askedFields.has('income')) continue;
    if (field === 'income' && askedFields.has('household_income')) continue;

    // Get the question definition
    const qDef = FIELD_QUESTIONS[field];
    if (!qDef || qDef.type === 'computed') continue;

    askedFields.add(field);
    questions.push({
      id: field,
      question: qDef.question,
      type: qDef.type,
      options: qDef.options || [],
      needed_for: programNames.slice(0, 4), // show up to 4 program names
      programs_count: programNames.length,
    });
  }

  // Sort: questions needed by MORE programs come first
  questions.sort((a, b) => b.programs_count - a.programs_count);

  return questions;
}

// ─── Eligibility Scoring ─────────────────────────────────────────────────────

function scoreEligibility(service, knownFields, answers) {
  const criteriasMet = [];
  const criteriasMissing = [];
  const eligibility = Array.isArray(service.eligibility) ? service.eligibility : [];
  const allData = { ...knownFields, ...answers };

  // 1. Check citizenship
  if (allData.nationality) {
    if (allData.nationality.toLowerCase().includes('filipino')) {
      criteriasMet.push('Filipino Citizen');
    } else {
      criteriasMissing.push('Must be a Filipino citizen');
    }
  }

  // 2. Check age-based criteria from eligibility text
  if (allData.age !== undefined) {
    for (const req of eligibility) {
      const reqLower = req.toLowerCase();
      const ageRangeMatch = reqLower.match(/(?:ages?\s*)?(\d+)\s*[-–to]+\s*(\d+)/);
      if (ageRangeMatch) {
        const minAge = parseInt(ageRangeMatch[1]);
        const maxAge = parseInt(ageRangeMatch[2]);
        if (allData.age >= minAge && allData.age <= maxAge) {
          criteriasMet.push(`Age requirement met (${allData.age} years old)`);
        } else {
          criteriasMissing.push(`Age must be ${minAge}–${maxAge} (you are ${allData.age})`);
        }
        break;
      }
      const minAgeMatch = reqLower.match(/(?:at least|reach.*age of|must.*be)\s*(\d+)/);
      if (minAgeMatch) {
        const minAge = parseInt(minAgeMatch[1]);
        if (allData.age >= minAge) {
          criteriasMet.push(`Age requirement met (${allData.age} years old)`);
        } else {
          criteriasMissing.push(`Must be at least ${minAge} years old`);
        }
        break;
      }
    }
  }

  // 3. Check location
  if (allData.province || allData.region) {
    criteriasMet.push(`Resident of ${allData.province || allData.region}`);
  }

  // 4. Check employment-related criteria
  if (allData.employment_status) {
    const empLower = allData.employment_status.toLowerCase();
    for (const req of eligibility) {
      const reqLower = req.toLowerCase();
      if (reqLower.includes('displaced') || reqLower.includes('underemployed') || reqLower.includes('unemployed')) {
        if (empLower.includes('unemployed') || empLower.includes('underemployed') || empLower.includes('seasonal') || empLower.includes('displaced')) {
          criteriasMet.push('Employment status matches program requirements');
        }
        break;
      }
      if (reqLower.includes('not currently employed by government')) {
        if (!empLower.includes('government')) {
          criteriasMet.push('Not employed by government');
        } else {
          criteriasMissing.push('Must not be currently employed by government');
        }
        break;
      }
    }
  }

  // 5. Check enrollment for education programs
  if (allData.enrollment_status) {
    const enrollLower = allData.enrollment_status.toLowerCase();
    for (const req of eligibility) {
      const reqLower = req.toLowerCase();
      if (reqLower.includes('enrolled') || reqLower.includes('student') || reqLower.includes('college')) {
        if (enrollLower.includes('enrolled') || enrollLower.includes('freshman') || enrollLower.includes('planning')) {
          criteriasMet.push('Enrollment requirement met');
        } else if (enrollLower.includes('not enrolled') || enrollLower.includes('graduated')) {
          criteriasMissing.push('Must be currently enrolled or planning to enroll');
        }
        break;
      }
    }
  }

  // 6. Check income for need-based programs
  if (allData.income || allData.household_income) {
    const income = allData.income || allData.household_income;
    for (const req of eligibility) {
      const reqLower = req.toLowerCase();
      if (reqLower.includes('income') && (reqLower.includes('below') || reqLower.includes('not exceeding') || reqLower.includes('indigent') || reqLower.includes('poor'))) {
        if (income.includes('Below') || income.includes('10,00') || income.includes('20,00')) {
          criteriasMet.push('Income requirement likely met');
        } else if (income.includes('Above') || income.includes('80,00')) {
          criteriasMissing.push('Household income may exceed program threshold');
        }
        break;
      }
    }
  }

  // 7. Check disability
  if (allData.disability_status || allData.disability_type) {
    const disability = (allData.disability_status || allData.disability_type || '').toLowerCase();
    for (const req of eligibility) {
      const reqLower = req.toLowerCase();
      if (reqLower.includes('disability') || reqLower.includes('pwd')) {
        if (disability.includes('no disability') || disability === '') {
          criteriasMissing.push('Program is for persons with disabilities');
        } else {
          criteriasMet.push('Disability status acknowledged');
        }
        break;
      }
    }
  }

  // Determine status
  let status;
  if (criteriasMissing.length === 0 && criteriasMet.length >= 2) {
    status = 'eligible';
  } else if (criteriasMissing.length === 0 && criteriasMet.length > 0) {
    status = 'eligible';
  } else if (criteriasMet.length === 0 && criteriasMissing.length === 0) {
    // No data to evaluate — mark as possibly eligible (not enough info to determine)
    status = 'possibly';
  } else if (criteriasMissing.length > 0 && criteriasMet.length > 0) {
    const hardDisqualifier = criteriasMissing.some(c =>
      c.toLowerCase().includes('age must be') ||
      c.toLowerCase().includes('must be a filipino') ||
      c.toLowerCase().includes('for persons with disabilities')
    );
    status = hardDisqualifier ? 'not-eligible' : 'possibly';
  } else if (criteriasMissing.length > 0) {
    const hardDisqualifier = criteriasMissing.some(c =>
      c.toLowerCase().includes('age must be') ||
      c.toLowerCase().includes('must be a filipino') ||
      c.toLowerCase().includes('for persons with disabilities')
    );
    status = hardDisqualifier ? 'not-eligible' : 'possibly';
  } else {
    status = 'possibly';
  }

  return { status, criteriasMet, criteriasMissing };
}

// ─── Chat Response Builder ───────────────────────────────────────────────────

function buildChatResponse(userMessage, programs, knownFields) {
  if (programs.length === 0) {
    return "I checked our database but couldn't find programs matching your specific situation right now. Here are some things you can try:\n\n" +
      "• Browse programs by category using the tabs above\n" +
      "• Visit your nearest barangay hall or DSWD office for local programs\n" +
      "• Try describing your situation differently (e.g., \"scholarship for college students\" or \"cash assistance for low income\")\n\n" +
      "How else can I help you?";
  }

  const eligible = programs.filter(p => p.status === 'eligible');
  const possibly = programs.filter(p => p.status === 'possibly');
  const userName = knownFields.nationality ? '' : '';

  let response = '';

  // Personalized greeting based on context
  if (eligible.length > 0) {
    response += `Great news! Based on your verified eGovPH profile, I found **${eligible.length} program${eligible.length > 1 ? 's' : ''}** you appear to qualify for:\n\n`;
    eligible.forEach((p, i) => {
      response += `**${i + 1}. ${p.name}**\n`;
      response += `   _${p.agency}_\n`;
      response += `   ${p.description}\n`;
      if (p.process && p.process.length > 0) {
        response += `   📋 First step: ${p.process[0]}\n`;
      }
      if (p.url) {
        response += `   🔗 Official site: ${p.url}\n`;
      }
      response += '\n';
    });
  }

  if (possibly.length > 0) {
    if (eligible.length > 0) {
      response += `I also found **${possibly.length} more program${possibly.length > 1 ? 's' : ''}** you may qualify for (some additional information may be needed):\n\n`;
    } else {
      response += `I found **${possibly.length} program${possibly.length > 1 ? 's' : ''}** that could help with your situation. To confirm your eligibility, I may need a bit more information:\n\n`;
    }
    possibly.slice(0, 5).forEach((p, i) => {
      response += `**${i + 1}. ${p.name}** (${p.agency})\n`;
      response += `   ${p.description}\n`;
      if (p.criteriasMissing && p.criteriasMissing.length > 0) {
        response += `   ℹ️ Note: ${p.criteriasMissing[0]}\n`;
      }
      response += '\n';
    });
  }

  if (response === '') {
    response = `I found ${programs.length} program${programs.length > 1 ? 's' : ''} that may be relevant. Try clicking "Discover Programs" above and answering a few questions so I can give you more accurate results.\n\n`;
  }

  response += "Would you like me to explain more about any of these programs, or help you understand the application process?";

  return response;
}

module.exports = {
  extractKnownFields,
  generateDynamicQuestions,
  scoreEligibility,
  calculateAge,
  buildChatResponse,
  FIELD_QUESTIONS,
};
