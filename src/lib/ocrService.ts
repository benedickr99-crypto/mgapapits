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

// Clean common noise words from government IDs
const NOISE_WORDS = new Set([
  "REPUBLIC", "PHILIPPINES", "PILIPINAS", "REPUBLIKA", "PAMBANSANG", "PAGKAKAKILANLAN",
  "IDENTIFICATION", "CARD", "DEPARTMENT", "LAND", "TRANSPORTATION", "OFFICE",
  "DRIVER", "LICENSE", "COMMISSION", "ELECTIONS", "PASSPORT", "SOCIAL", "SECURITY",
  "SYSTEM", "UNIFIED", "MULTI-PURPOSE", "POSTAL", "ID", "SIGNATURE", "SEX", "DATE",
  "BIRTH", "NATIONALITY", "FILIPINO", "ADDRESS", "BLOOD", "TYPE", "WEIGHT", "HEIGHT",
  "RESTRICTIONS", "CONDITIONS", "EXPIRATION", "AGENCY", "GOVERNMENT", "OFFICIAL", "VALID"
]);

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
  // Matches YYYY/MM/DD, DD/MM/YYYY, YYYY-MM-DD, or Month DD, YYYY
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

  // Detect Name
  // Common label patterns on Philippine IDs:
  // "Last Name, First Name Middle Name" or "Name: John Doe" or "Given Names: ..."
  const nameLabelRegex = /(?:NAME|PANGALAN|GIVEN\s*NAME|SURNAME|LAST\s*NAME)[:\s]+([A-Za-z\s,.-]{4,40})/i;
  const labelMatch = rawText.match(nameLabelRegex);
  if (labelMatch && labelMatch[1]) {
    const clean = labelMatch[1].replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
    if (clean.length > 3 && !NOISE_WORDS.has(clean.toUpperCase())) {
      result.detectedName = toTitleCase(clean);
    }
  }

  // If label didn't catch it, search for capitalized line with 2-4 words that isn't noise
  if (!result.detectedName) {
    for (const line of lines) {
      const trimmed = line.replace(/[^A-Za-z\s]/g, "").trim();
      const words = trimmed.split(/\s+/).filter((w) => w.length > 1);
      if (words.length >= 2 && words.length <= 4) {
        const isAllNoise = words.every((w) => NOISE_WORDS.has(w.toUpperCase()));
        if (!isAllNoise && words.every((w) => /^[A-Z][a-z]+$|^[A-Z]+$/.test(w))) {
          // Exclude lines with common header phrases
          const upperLine = trimmed.toUpperCase();
          if (
            !upperLine.includes("REPUBLIC") &&
            !upperLine.includes("PHILIPPINES") &&
            !upperLine.includes("DEPARTMENT") &&
            !upperLine.includes("CERTIFICATE") &&
            !upperLine.includes("OFFICE")
          ) {
            result.detectedName = toTitleCase(trimmed);
            break;
          }
        }
      }
    }
  }

  // Detect ID / Reference Number (e.g. 1234-5678-9012 or N01-12-345678)
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

function cleanTokens(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function tokenMatches(t1: string, t2: string): boolean {
  if (t1 === t2) return true;
  if (t1.includes(t2) || t2.includes(t1)) return true;
  if (t1.length >= 4 && t2.length >= 4 && Math.abs(t1.length - t2.length) <= 1) {
    let diff = 0;
    const minLen = Math.min(t1.length, t2.length);
    for (let i = 0; i < minLen; i++) {
      if (t1[i] !== t2[i]) diff++;
      if (diff > 1) return false;
    }
    return true;
  }
  return false;
}

/**
 * Checks whether the participant's name matches the name or text found on the government ID
 */
export function checkIdNameMatch(
  participantName: string,
  detectedName?: string,
  rawText?: string
): { isMatch: boolean; reason?: string } {
  if (!participantName || !participantName.trim()) {
    return { isMatch: false, reason: "Participant name is empty" };
  }

  const pTokens = cleanTokens(participantName);
  if (pTokens.length === 0) {
    return { isMatch: false, reason: "Participant name is too short" };
  }

  const dTokens = detectedName ? cleanTokens(detectedName) : [];
  const rawTokens = rawText ? cleanTokens(rawText) : [];

  if (dTokens.length === 0 && rawTokens.length === 0) {
    return { isMatch: false, reason: "No readable name found on ID. The ID must be visible and legible." };
  }

  let matchedCount = 0;
  for (const pt of pTokens) {
    const foundInDet = dTokens.some((dt) => tokenMatches(pt, dt));
    const foundInRaw = rawTokens.some((rt) => tokenMatches(pt, rt));
    if (foundInDet || foundInRaw) {
      matchedCount++;
    }
  }

  const requiredMatches = pTokens.length === 1 ? 1 : Math.min(2, pTokens.length);
  const isMatch = matchedCount >= requiredMatches;

  return {
    isMatch,
    reason: isMatch
      ? "Name matches ID"
      : `ID does not match "${participantName}". The ID must be visible and legible.`,
  };
}

