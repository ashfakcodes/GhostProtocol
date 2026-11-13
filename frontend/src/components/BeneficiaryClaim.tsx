import React, { useState } from 'react';
import { KeyRound, Unlock, FileText, CheckCircle2, AlertCircle, Copy, Check, Sparkles } from 'lucide-react';
import { recombineAndDecrypt } from '../lib/crypto';

interface BeneficiaryClaimProps {
  contractKeyShareA: string | null;
  status: string;
}

export const BeneficiaryClaim: React.FC<BeneficiaryClaimProps> = ({
  contractKeyShareA,
  status
}) => {
  const [shareA, setShareA] = useState(
    contractKeyShareA && contractKeyShareA !== 'SHARE_A_SEC_98a7cf28b' ? contractKeyShareA : ''
  );
  const [shareB, setShareB] = useState('');
  const [iv, setIv] = useState('');
  const [ciphertext, setCiphertext] = useState('');
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const [savedShareB, setSavedShareB] = useState<string | null>(null);
  const [savedShareA, setSavedShareA] = useState<string | null>(null);

  const isUnlocked = status === 'Executed' || status === 'GhostAwake';

  // Auto-fill shareA when contract reveals it
  React.useEffect(() => {
    if (contractKeyShareA && contractKeyShareA !== 'SHARE_A_SEC_98a7cf28b') {
      setShareA(contractKeyShareA);
    }
  }, [contractKeyShareA]);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('ghost_vault_sealed_bundle');
      if (stored) {
        const bundle = JSON.parse(stored);
        if (bundle.ciphertext) setCiphertext(bundle.ciphertext);
        if (bundle.iv) setIv(bundle.iv);
        if (bundle.shareB) setSavedShareB(bundle.shareB);
        if (bundle.shareA) {
          setSavedShareA(bundle.shareA);
          if (isUnlocked && (!shareA || shareA === 'SHARE_A_SEC_98a7cf28b')) {
            setShareA(bundle.shareA);
          }
        }
      }
    } catch (e) {}
  }, [contractKeyShareA, isUnlocked]);

  const handleDecrypt = async () => {
    setError(null);
    if (!isUnlocked) {
      setError("Share A is strictly locked inside the NEAR Smart Contract while Proof-of-Life is active (ALIVE). Click [Simulate Absence] in the top header to release Share A.");
      return;
    }
    if (!shareA.trim() || !shareB.trim()) {
      setError("Both Share A (Contract) and Share B (Heir) are strictly required for 256-bit XOR reconstruction.");
      return;
    }

    const testCiphertext = ciphertext ? ciphertext.trim() : '';
    const testIv = iv ? iv.trim() : '';

    if (!testCiphertext || !testIv) {
      setError("No sealed vault payload found. Please seal directives in Tab 2 first.");
      return;
    }

    try {
      // Perform strict WebCrypto AES-256-GCM decryption with reconstructed master key
      try {
        const result = await recombineAndDecrypt(shareA, shareB, testCiphertext, testIv);
        setDecryptedMessage(result);
      } catch (cryptoErr: any) {
        console.error("Cryptographic decryption failed:", cryptoErr);
        setError("Decryption failed: Key shares do not match the sealed vault ciphertext or have been corrupted. Authorization denied.");
        setDecryptedMessage(null);
      }
    } catch (e: any) {
      setError(e.message || "Decryption failed. Invalid mathematical shares.");
    }
  };

  const copyNote = () => {
    if (decryptedMessage) {
      navigator.clipboard.writeText(decryptedMessage);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2000);
    }
  };

  return (
    <div className="bg-obsidian-900 border border-obsidian-700/60 rounded-2xl p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Beneficiary Recovery & Decryption Portal
            </h3>
            <p className="text-xs text-slate-400">
              Proof-of-Absence releases Share A from the smart contract. Recombine with your Share B to reveal the estate.
            </p>
          </div>
        </div>

        {isUnlocked ? (
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            SHARE A RELEASED
          </span>
        ) : (
          <span className="text-xs font-mono text-slate-400 bg-obsidian-800 border border-obsidian-700 px-2.5 py-0.5 rounded">
            LOCKED ONCHAIN
          </span>
        )}
      </div>

      {/* Proof-of-Life Status Explainer */}
      {!isUnlocked ? (
        <div className="mb-4 p-3 bg-obsidian-950/80 border border-amber-500/30 rounded-xl text-xs text-amber-300/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>
              <strong>Contract Lock Active:</strong> Share A is cryptographically locked while Proof-of-Life is valid. Click <span className="font-mono bg-obsidian-800 text-white px-1.5 py-0.5 rounded border border-obsidian-700 font-bold">[Simulate Absence]</span> in the header to release it.
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            <strong>Proof-of-Absence Verified:</strong> NEAR Smart Contract has unlocked Share A. Recombine with Share B below to decrypt directives.
          </span>
        </div>
      )}

      {/* Input Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-mono text-slate-400 block">
              SHARE A (FROM NEAR CONTRACT)
            </label>
            {isUnlocked && savedShareA && !shareA && (
              <button
                type="button"
                onClick={() => setShareA(savedShareA)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono underline cursor-pointer"
              >
                Auto-fill Released Share A
              </button>
            )}
          </div>
          <input
            type="text"
            value={shareA}
            onChange={(e) => setShareA(e.target.value)}
            disabled={!isUnlocked}
            placeholder={isUnlocked ? "Auto-synced from NEAR..." : "Locked onchain until Proof-of-Absence..."}
            className={`w-full bg-obsidian-950 border rounded-lg px-3 py-2 text-xs font-mono transition-colors ${
              isUnlocked
                ? 'border-obsidian-700 text-slate-200 focus:outline-none focus:border-zinc-500'
                : 'border-obsidian-800 text-slate-500 cursor-not-allowed opacity-60'
            }`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-mono text-slate-400 block">
              SHARE B (HEIR PRIVATE SHARE)
            </label>
            {savedShareB && !shareB && (
              <button
                type="button"
                onClick={() => setShareB(savedShareB)}
                className="text-[10px] text-sky-400 hover:text-sky-300 font-mono underline cursor-pointer"
              >
                Auto-fill Sealed Share B
              </button>
            )}
          </div>
          <input
            type="text"
            value={shareB}
            onChange={(e) => setShareB(e.target.value)}
            placeholder="Paste your 64-character Share B here..."
            className="w-full bg-obsidian-950 border border-obsidian-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!decryptedMessage ? (
        <button
          onClick={handleDecrypt}
          disabled={!shareB}
          className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-medium py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <KeyRound className="w-4 h-4" />
          <span>Decrypt Sovereign Legacy Document</span>
        </button>
      ) : (
        <div className="bg-obsidian-950 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              DECRYPTION SUCCESSFUL (MATHEMATICAL SHARES MATCHED)
            </span>
            <button
              onClick={copyNote}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
            >
              {copiedNote ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedNote ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <pre className="text-xs font-mono text-slate-200 bg-obsidian-900 p-3.5 rounded-lg whitespace-pre-wrap leading-relaxed border border-obsidian-800">
            {decryptedMessage}
          </pre>
        </div>
      )}
    </div>
  );
};
