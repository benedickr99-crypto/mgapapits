import { createWorker } from "tesseract.js";

export interface OcrExtractedData {
  rawText: string;
  confidence: number;
  detectedName?: string;
  detectedAge?: number;
  detectedBirthDate?: string;
  detectedGender?: "Male" | "Female";
  detectedIdType?: string;
  detectedIdNumber?: string;
}

export interface NameMatchResult {
  isMatch: boolean;
  reason: string;
  matchedName?: string;
}

// Clean common noise words from government IDs
const NOISE_WORDS = new Set([
  "REPUBLIC", "PHILIPPINES", "PILIPINAS", "REPUBLIKA", "PAMBANSANG", "PAGKAKAKILANLAN",
  "IDENTIFICATION", "CARD", "DEPARTMENT", "LAND", "TRANSPORTATION", "OFFICE",
  "DRIVER", "LICENSE", "COMMISSION", "ELECTIONS", "PASSPORT", "SOCIAL", "SECURITY",
  "SYSTEM", "UNIFIED", "MULTI-PURPOSE", "POSTAL", "ID", "SIGNATURE", "SEX", "DATE",
  "BIRTH", "NATIONALITY", "FILIPINO", "ADDRESS", "BLOOD", "TYPE", "WEIGHT", "HEIGHT",
  "RESTRICTIONS", "CONDITIONS", "EXPIRATION", "AGENCY", "GOVERNMENT", "OFFICIAL", "VALID",
  "BARANGAY", "CLEARANCE", "POLICE", "NBI", "TAX", "TIN", "VOTER", "VOTERS", "MEMBER",
  "REGISTERED", "REGISTRATION", "CERTIFICATE", "CERTIFICATION", "AUTHORITY", "HEALTH",
  "INSURANCE", "PHILHEALTH", "SENIOR", "CITIZEN", "PERSONS", "DISABILITY", "PWD",
  "STUDENT", "COLLEGE", "UNIVERSITY", "SCHOOL", "TREKKING", "WAIVER", "LIABILITY",
  "PERMIT", "TOURISM", "PARK", "PROTECTED", "AREA", "MANAGEMENT", "BOARD", "PAMB", "DENR"
]);

/**
 * Checks whether a single word looks like a legitimate person name component
 */
function isValidNameWord(w: string): boolean {
  if (w.length < 2) return false;
  if (!/^[a-zA-Z]+$/.test(w)) return false;
  // Must contain at least one vowel
  if (!/[aeiouyAEIOUY]/.test(w)) return false;
  // Must not be an administrative noise word
  if (NOISE_WORDS.has(w.toUpperCase())) return false;
  return true;
}

/**
 * Validates if a string is a credible full name
 */
function isValidFullNameCandidate(str: string): boolean {
  if (!str) return false;
  const cleaned = str.replace(/[^A-Za-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 5 || cleaned.length > 40) return false;

  const words = cleaned.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;

  // Every word must be a valid name word
  if (!words.every(isValidNameWord)) return false;

  // At least one word must have at least 3 characters
  if (!words.some((w) => w.length >= 3)) return false;

  const upper = cleaned.toUpperCase();
  if (
    upper.includes("REPUBLIC") ||
    upper.includes("PHILIPPINES") ||
    upper.includes("DEPARTMENT") ||
    upper.includes("CERTIFICATE") ||
    upper.includes("OFFICE") ||
    upper.includes("COMMISSION") ||
    upper.includes("REGISTRATION")
  ) {
    return false;
  }

  return true;
}

function cleanNameCandidate(raw: string): string {
  return raw.replace(/[^A-Za-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parses raw OCR text to extract name, age/birthdate, gender, and ID type
 */
export function parseIdDocumentText(rawText: string): Partial<OcrExtractedData> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const upperText = rawText.toUpperCase();
  const result: Partial<OcrExtractedData> = {};

  // Detect ID Type
  if (upperText.includes("PHILSYS") || upperText.includes("PAMBANSANG PAGKAKAKILANLAN")) {
    result.detectedIdType = "Philippine National ID (PhilSys)";
  } else if (upperText.includes("DRIVER") || upperText.includes("TRANSPORTATION OFFICE") || upperText.includes("LTO")) {
    result.detectedIdType = "Driver's License (LTO)";
  } else if (upperText.includes("PASSPORT") || upperText.includes("PASAPORTE")) {
    result.detectedIdType = "Philippine Passport";
  } else if (upperText.includes("UNIFIED") || upperText.includes("UMID")) {
    result.detectedIdType = "UMID Card";
  } else if (upperText.includes("POSTAL")) {
    result.detectedIdType = "Postal ID";
  } else if (upperText.includes("VOTER") || upperText.includes("COMELEC")) {
    result.detectedIdType = "Voter's ID";
  } else if (upperText.includes("FIT") || upperText.includes("CLIMB") || upperText.includes("MEDICAL") || upperText.includes("CERTIFICATE") || upperText.includes("PHYSICIAN")) {
    result.detectedIdType = "Fit-to-Climb Medical Certificate";
  } else if (upperText.includes("WAIVER") || upperText.includes("LIABILITY") || upperText.includes("DENR")) {
    result.detectedIdType = "DENR Trekking Waiver Form";
  } else {
    result.detectedIdType = "Government-Issued ID";
  }

  // Detect Gender
  if (/\b(FEMALE|F)\b/i.test(upperText) && !/\b(MALE)\b/i.test(upperText)) {
    result.detectedGender = "Female";
  } else if (/\b(MALE|M)\b/i.test(upperText)) {
    result.detectedGender = "Male";
  }

  // Detect Birth Date & Calculate Age
  const datePatterns = [
    /\b(19\d\d|20[0-2]\d)[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/, // YYYY-MM-DD
    /\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](19\d\d|20[0-2]\d)\b/, // DD-MM-YYYY
    /\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2})[,.]?\s+(19\d\d|20[0-2]\d)\b/i,
  ];

  for (const pattern of datePatterns) {
    const match = rawText.match(pattern);
    if (match) {
      const yearMatch = match[0].match(/\b(19\d\d|20[0-2]\d)\b/);
      if (yearMatch) {
        const birthYear = parseInt(yearMatch[1], 10);
        const currentYear = new Date().getFullYear();
        const calculatedAge = currentYear - birthYear;
        if (calculatedAge >= 10 && calculatedAge <= 90) {
          result.detectedAge = calculatedAge;
          result.detectedBirthDate = match[0];
          break;
        }
      }
    }
  }

  // Fallback direct Age regex: "Age: 25" or "Age 25"
  if (!result.detectedAge) {
    const ageMatch = rawText.match(/\b(?:AGE|EDAD)[:\s]+(\d{1,2})\b/i);
    if (ageMatch) {
      const parsedAge = parseInt(ageMatch[1], 10);
      if (parsedAge >= 10 && parsedAge <= 90) {
        result.detectedAge = parsedAge;
      }
    }
  }

  // Detect Name using common Philippine ID labels
  let lastNameFound = "";
  let givenNameFound = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check Last Name / Apelyido
    const lastNameMatch = line.match(/(?:APELYIDO|LAST\s*NAME|SURNAME|NOM)\s*[:/]?\s*([A-Za-z\s-]{2,30})/i);
    if (lastNameMatch && lastNameMatch[1].trim().length > 1) {
      const val = cleanNameCandidate(lastNameMatch[1]);
      if (val && isValidNameWord(val.split(/\s+/)[0])) {
        lastNameFound = val;
      }
    } else if (/(?:APELYIDO|LAST\s*NAME|SURNAME|NOM)\s*[:/]?$/i.test(line) && lines[i + 1]) {
      const nextVal = cleanNameCandidate(lines[i + 1]);
      if (nextVal && isValidNameWord(nextVal.split(/\s+/)[0])) {
        lastNameFound = nextVal;
      }
    }

    // Check Given Name / Mga Pangalan
    const givenNameMatch = line.match(/(?:MGA\s*PANGALAN|GIVEN\s*NAMES?|FIRST\s*NAME|PR[EÉ]NOMS?)\s*[:/]?\s*([A-Za-z\s-]{2,40})/i);
    if (givenNameMatch && givenNameMatch[1].trim().length > 1) {
      const val = cleanNameCandidate(givenNameMatch[1]);
      if (val && isValidNameWord(val.split(/\s+/)[0])) {
        givenNameFound = val;
      }
    } else if (/(?:MGA\s*PANGALAN|GIVEN\s*NAMES?|FIRST\s*NAME)\s*[:/]?$/i.test(line) && lines[i + 1]) {
      const nextVal = cleanNameCandidate(lines[i + 1]);
      if (nextVal && isValidNameWord(nextVal.split(/\s+/)[0])) {
        givenNameFound = nextVal;
      }
    }

    // Check Combined "Name: First Last" or "Name: Last, First"
    const fullNameMatch = line.match(/(?:FULL\s*NAME|NAME|PANGALAN)\s*[:/]?\s*([A-Za-z\s,.-]{4,40})/i);
    if (fullNameMatch && fullNameMatch[1] && !lastNameFound && !givenNameFound) {
      const candidate = cleanNameCandidate(fullNameMatch[1]);
      if (isValidFullNameCandidate(candidate)) {
        result.detectedName = toTitleCase(candidate);
      }
    }
  }

  if (givenNameFound && lastNameFound) {
    result.detectedName = toTitleCase(`${givenNameFound} ${lastNameFound}`);
  } else if (givenNameFound && !result.detectedName) {
    result.detectedName = toTitleCase(givenNameFound);
  }

  // If label didn't catch it, search for a line with valid full name characteristics
  if (!result.detectedName) {
    for (const line of lines) {
      const candidate = cleanNameCandidate(line);
      if (isValidFullNameCandidate(candidate)) {
        result.detectedName = toTitleCase(candidate);
        break;
      }
    }
  }

  // Detect ID / Reference Number
  const idNumMatch = rawText.match(/\b([A-Z0-9]{3,4}[-\s]?[A-Z0-9]{3,4}[-\s]?[A-Z0-9]{3,6})\b/);
  if (idNumMatch) {
    result.detectedIdNumber = idNumMatch[1];
  }

  return result;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Runs Tesseract OCR on an image file or URL
 */
export async function runTesseractOcr(
  imageSource: File | Blob | string,
  onProgress?: (progress: number, status: string) => void
): Promise<OcrExtractedData> {
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (onProgress && typeof m.progress === "number") {
        onProgress(Math.round(m.progress * 100), m.status || "processing");
      }
    },
  });

  try {
    const ret = await worker.recognize(imageSource);
    const parsed = parseIdDocumentText(ret.data.text);

    return {
      rawText: ret.data.text,
      confidence: Math.round(ret.data.confidence),
      detectedName: parsed.detectedName,
      detectedAge: parsed.detectedAge,
      detectedBirthDate: parsed.detectedBirthDate,
      detectedGender: parsed.detectedGender,
      detectedIdType: parsed.detectedIdType,
      detectedIdNumber: parsed.detectedIdNumber,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Standard Levenshtein edit distance
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Checks if a candidate word from OCR matches an expected name token
 */
function isTokenMatch(expected: string, candidate: string): boolean {
  if (expected === candidate) return true;

  // Words with length <= 3 (e.g. "Rey", "Pao", "Lee", "Lim", "Tan", "Sy") must match strictly
  if (expected.length <= 3 || candidate.length <= 3) {
    return expected === candidate;
  }

  // Length difference must not be more than 2
  const lenDiff = Math.abs(expected.length - candidate.length);
  if (lenDiff > 2) return false;

  const dist = levenshteinDistance(expected, candidate);

  // For 4-5 chars (e.g. "Juan", "Cruz"): allow at most 1 typo
  if (expected.length <= 5) {
    return dist <= 1;
  }

  // For 6-7 chars (e.g. "Rafael", "Marfil"): allow at most 1 typo
  if (expected.length <= 7) {
    return dist <= 1;
  }

  // For 8+ chars (e.g. "Villanueva"): allow at most 2 typos
  return dist <= 2;
}

/**
 * Extracts clean, valid name tokens from a name string
 */
function extractNameTokens(nameStr: string): string[] {
  return nameStr
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => {
      if (NOISE_WORDS.has(t.toUpperCase())) return false;
      if (["jr", "sr", "ii", "iii", "iv", "mr", "ms", "mrs"].includes(t)) return false;
      return t.length >= 2 && /[aeiouy]/.test(t);
    });
}

/**
 * Checks whether the participant's name matches the name or text found on the government ID
 */
export function checkIdNameMatch(
  participantName: string,
  detectedName?: string,
  rawText?: string
): { isMatch: boolean; reason: string; matchedName?: string } {
  if (!participantName || !participantName.trim()) {
    return { isMatch: false, reason: "Participant name is empty" };
  }

  const expectedTokens = extractNameTokens(participantName);
  if (expectedTokens.length === 0) {
    return { isMatch: false, reason: "Participant name is too short or invalid" };
  }

  // For 1-word name: 1 required. For 2-word name ("Rafael Marfil"): 2 required. For 3+ words: at least 2 required.
  const requiredMatches = expectedTokens.length <= 2 ? expectedTokens.length : 2;

  // 1. Check against detectedName if present and valid
  if (detectedName && detectedName.trim()) {
    const dTokens = extractNameTokens(detectedName);
    const matchedFromDetected = new Set<string>();
    for (const et of expectedTokens) {
      if (dTokens.some((dt) => isTokenMatch(et, dt))) {
        matchedFromDetected.add(et);
      }
    }
    if (matchedFromDetected.size >= requiredMatches) {
      return {
        isMatch: true,
        reason: "Name matches ID",
        matchedName: detectedName,
      };
    }
  }

  // 2. Search rawText lines
  if (!rawText || !rawText.trim()) {
    return {
      isMatch: false,
      reason: `ID does not match "${participantName}". No readable text found on ID.`,
    };
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Strategy A: Check line-by-line (e.g. participant name on same line)
  for (const line of lines) {
    const lineTokens = extractNameTokens(line);
    const lineMatches = new Set<string>();
    for (const et of expectedTokens) {
      if (lineTokens.some((lt) => isTokenMatch(et, lt))) {
        lineMatches.add(et);
      }
    }
    if (lineMatches.size >= requiredMatches) {
      return {
        isMatch: true,
        reason: "Name matches ID",
        matchedName: toTitleCase(lineTokens.join(" ")),
      };
    }
  }

  // Strategy B: Check adjacent lines (e.g. line 1: Last Name, line 2: First Name)
  for (let i = 0; i < lines.length - 1; i++) {
    const combinedTokens = extractNameTokens(`${lines[i]} ${lines[i + 1]}`);
    const adjMatches = new Set<string>();
    for (const et of expectedTokens) {
      if (combinedTokens.some((ct) => isTokenMatch(et, ct))) {
        adjMatches.add(et);
      }
    }
    if (adjMatches.size >= requiredMatches) {
      return {
        isMatch: true,
        reason: "Name matches ID",
        matchedName: toTitleCase(combinedTokens.join(" ")),
      };
    }
  }

  // Strategy C: Check distinct candidate tokens across the entire document
  const allDocTokens = extractNameTokens(rawText);
  const matchedTokens = new Set<string>();
  const usedCandidateIndices = new Set<number>();

  for (const et of expectedTokens) {
    for (let ci = 0; ci < allDocTokens.length; ci++) {
      if (usedCandidateIndices.has(ci)) continue;
      if (isTokenMatch(et, allDocTokens[ci])) {
        matchedTokens.add(et);
        usedCandidateIndices.add(ci);
        break;
      }
    }
  }

  const isMatch = matchedTokens.size >= requiredMatches;

  return {
    isMatch,
    reason: isMatch
      ? "Name matches ID"
      : `ID does not match "${participantName}". The ID must be visible, legible, and clearly display the participant's name.`,
    matchedName: isMatch ? participantName : undefined,
  };
}
