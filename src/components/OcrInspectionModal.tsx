import { useState, useEffect } from "react";
import {
  X,
  ScanText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Check,
  FileText,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { runTesseractOcr, checkIdNameMatch, type OcrExtractedData } from "@/lib/ocrService";

interface OcrInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSource: File | Blob | string | null;
  documentTitle?: string;
  expectedName?: string;
  onApplyExtracted?: (data: OcrExtractedData) => void;
}

export function OcrInspectionModal({
  isOpen,
  onClose,
  imageSource,
  documentTitle = "Document Inspection",
  expectedName,
  onApplyExtracted,
}: OcrInspectionModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [ocrData, setOcrData] = useState<OcrExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Setup preview URL
  useEffect(() => {
    if (!imageSource) {
      setPreviewUrl(null);
      return;
    }

    if (typeof imageSource === "string") {
      setPreviewUrl(imageSource);
    } else {
      const url = URL.createObjectURL(imageSource);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageSource]);

  // Automatically start OCR when modal opens with an image
  useEffect(() => {
    if (isOpen && imageSource && !ocrData && !isScanning) {
      handleStartScan();
    }
    if (!isOpen) {
      // Reset state on close
      setOcrData(null);
      setError(null);
      setProgress(0);
      setIsScanning(false);
    }
  }, [isOpen, imageSource]);

  const handleStartScan = async () => {
    if (!imageSource) return;
    setIsScanning(true);
    setError(null);
    setProgress(0);
    setStatusText("Initializing Tesseract OCR engine...");

    try {
      const result = await runTesseractOcr(imageSource, (p, status) => {
        setProgress(p);
        setStatusText(status);
      });
      setOcrData(result);
    } catch (err: unknown) {
      console.error("Tesseract OCR scan failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to scan document with Tesseract OCR. Ensure the image is legible."
      );
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  // Name match comparison logic
  const isNameMatch = () => {
    if (!expectedName || !ocrData) return null;
    return checkIdNameMatch(expectedName, ocrData.detectedName, ocrData.rawText).isMatch;
  };

  const nameMatchStatus = isNameMatch();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-800 to-teal-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <ScanText className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Tesseract OCR Verification
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 bg-emerald-400/20 text-emerald-200 rounded-full border border-emerald-400/30">
                  AI Optical Recognition
                </span>
              </h3>
              <p className="text-xs text-emerald-100/80">{documentTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Progress / Scanning State */}
          {isScanning && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  {statusText || "Processing with Tesseract OCR..."}
                </span>
                <span className="tabular-nums font-bold text-emerald-700">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
              <p className="text-[11px] text-emerald-700">
                Extracting typography, government header text, legal names, and identification stamps...
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-start gap-3 text-red-800 text-xs">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">OCR Scan Warning</p>
                <p className="mt-0.5">{error}</p>
                <button
                  type="button"
                  onClick={handleStartScan}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-[11px] transition"
                >
                  <RefreshCw className="w-3 h-3" /> Retry OCR Scan
                </button>
              </div>
            </div>
          )}

          {/* Side-by-side: Image Preview & Extracted OCR Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: Document Preview */}
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex flex-col">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                Original Document
              </span>
              <div className="flex-1 min-h-[220px] max-h-[300px] bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden relative">
                {previewUrl ? (
                  previewUrl.endsWith(".pdf") ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      PDF Document format
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block mt-2 font-bold text-emerald-700 hover:underline"
                      >
                        Open PDF in new tab
                      </a>
                    </div>
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Document scan"
                      className="w-full h-full object-contain"
                    />
                  )
                ) : (
                  <div className="text-xs text-gray-400">No preview available</div>
                )}
              </div>
              <div className="mt-2 flex justify-between items-center pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleStartScan}
                  disabled={isScanning || !imageSource}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
                  Re-run OCR Scan
                </button>
                {ocrData && (
                  <span className="text-[11px] text-gray-500 font-medium">
                    Confidence:{" "}
                    <span className="font-bold text-emerald-700">
                      {ocrData.confidence}%
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Right: Parsed Information */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Tesseract Extracted Metadata
              </span>

              {ocrData ? (
                <div className="space-y-3">
                  {/* Name Card */}
                  <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Detected Full Name
                    </span>
                    <p className="text-sm font-bold text-gray-900">
                      {ocrData.detectedName || (
                        <span className="text-gray-400 italic font-normal">
                          Not clearly parsed (see raw text below)
                        </span>
                      )}
                    </p>
                    {expectedName && (
                      <div className="pt-1.5 border-t border-gray-100 flex items-center gap-1 text-[11px]">
                        {nameMatchStatus ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Matches Expected: &ldquo;{expectedName}&rdquo;
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            Expected: &ldquo;{expectedName}&rdquo;
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Document Type & ID Number */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Doc Classification
                      </span>
                      <span className="text-xs font-semibold text-gray-800">
                        {ocrData.detectedIdType || "Valid ID"}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        ID / Serial No.
                      </span>
                      <span className="text-xs font-semibold text-gray-800 font-mono">
                        {ocrData.detectedIdNumber || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Age & Gender */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Detected Age / DOB
                      </span>
                      <span className="text-xs font-semibold text-gray-800">
                        {ocrData.detectedAge ? `${ocrData.detectedAge} yrs old` : ocrData.detectedBirthDate || "Not detected"}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Detected Sex
                      </span>
                      <span className="text-xs font-semibold text-gray-800">
                        {ocrData.detectedGender || "Not detected"}
                      </span>
                    </div>
                  </div>

                  {/* Apply Extracted button */}
                  {onApplyExtracted && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyExtracted(ocrData);
                        onClose();
                      }}
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {expectedName ? "Confirm & Store OCR Verification in Database" : "Auto-fill Participant Details with OCR"}
                    </button>
                  )}
                </div>
              ) : !isScanning ? (
                <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-xl">
                  <p className="text-xs text-gray-500 mb-2">No OCR scan executed yet.</p>
                  <button
                    type="button"
                    onClick={handleStartScan}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    Start Tesseract OCR
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Powered by Tesseract.js (WASM / WebWorker) • DENR NNNP Automated Compliance
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

