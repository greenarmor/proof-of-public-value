import { useState, useEffect } from "react";

const FACTS = [
  "The Philippines loses an estimated ₱700 billion annually to corruption.",
  "Stellar testnet processes 1 ledger every ~5 seconds.",
  "PoPV's 5-gate escrow: no single person can release funds alone.",
  "Soroban smart contracts cannot access the internet - all analysis is off-chain.",
  "Every decision in PoPV is recorded with an immutable Stellar transaction hash.",
  "The Procurement Marketplace uses integrity-weighted bidding to detect collusion.",
  "Community verification is the 4th gate - citizens verify projects on the ground.",
  "pPHP is a zero-value simulation token for testing escrow at realistic amounts.",
  "Civil society groups recover less than 1% of stolen public funds through courts.",
  "Only 3 out of 10 Filipinos believe their tax money is well spent — World Bank 2024.",
  "The Provenance Chain links every PVO event to its Stellar transaction hash.",
  "PoPV has 14 roles: from Administrator to CentralBank to Citizen.",
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function BlockchainLoader({ text = "Syncing with Stellar testnet..." }: { text?: string }) {
  const [fact, setFact] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p + 1) % 12);
      setFact((f) => (f + 1) % FACTS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const blocks = Array.from({ length: 6 }, (_, i) => {
    const state =
      i < Math.floor(progress / 2)
        ? "verified"
        : i === Math.floor(progress / 2)
        ? "scanning"
        : "pending";
    return { i, state };
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 sm:space-y-6 px-2">
      {/* Blockchain block animation */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {blocks.map((block) => (
          <div key={block.i} className="flex items-center gap-1 sm:gap-1.5">
            <div
              className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg border-2 flex items-center justify-center text-[10px] sm:text-xs font-mono transition-all duration-500 ${
                block.state === "verified"
                  ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                  : block.state === "scanning"
                  ? "bg-purple-100 border-purple-400 text-purple-700 animate-pulse"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
            >
              {block.i + 1}
            </div>
            {block.i < 5 && (
              <div
                className={`w-3 h-0.5 sm:w-6 sm:h-0.5 transition-colors duration-500 ${
                  block.i < Math.floor(progress / 2)
                    ? "bg-emerald-400"
                    : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Status text */}
      <div className="text-center space-y-1">
        <p className="text-xs sm:text-sm font-medium text-slate-600">{text}</p>
        <p className="text-[10px] sm:text-xs text-slate-400">
          {blocks.filter((b) => b.state === "verified").length} of {blocks.length} blocks verified
        </p>
      </div>

      {/* Rotating fact */}
      <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-xl px-3 py-2 sm:px-5 sm:py-3 max-w-[90vw] sm:max-w-md text-center transition-all duration-500 ease-in-out">
        <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">💡 {FACTS[fact % FACTS.length]}</p>
      </div>
    </div>
  );
}

export function BlockchainCardLoader({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="card p-5 skeleton h-32"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}
