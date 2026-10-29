import React, { useState } from 'react';
import { Lock, KeyRound, Copy, Check, ShieldAlert, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { encryptAndSplit, SplitKeyResult } from '../lib/crypto';

interface VaultEncryptorProps {
  onVaultSealed: (shareA: string, ciphertextHash: string) => void;
}

export const VaultEncryptor: React.FC<VaultEncryptorProps> = ({ onVaultSealed }) => {
  const [plaintext, setPlaintext] = useState(
    "To my daughter:\n" +
    "1. Cold Storage Ledger Seed: velvet mystery canyon echo frozen liquid pulse timber flame\n" +
    "2. Primary bank account recovery email: family-trust@proton.me\n" +
    "3. All cross-chain perpetual positions were unwound to USDC by my Ghost Agent on NEAR. Live well."
  );
  const [beneficiary, setBeneficiary] = useState("heir.testnet");
  const [beneficiaryTg, setBeneficiaryTg] = useState("@heir_telegram");
  const [splitResult, setSplitResult] = useState<SplitKeyResult | null>(null);
  const [copiedShareB, setCopiedShareB] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [showPlaintext, setShowPlaintext] = useState(false);

  const handleEncryptAndSeal = async () => {
    setIsEncrypting(true);
    try {
      const res = await encryptAndSplit(plaintext);
      setSplitResult(res);
      // Pass Share A & ciphertext hash to the contract
      onVaultSealed(res.shareA, res.ciphertext.slice(0, 32));
    } catch (e) {
      console.error("Encryption error:", e);
    } finally {
      setIsEncrypting(false);
    }
  };

  const copyShareB = () => {
    if (splitResult) {
      navigator.clipboard.writeText(splitResult.shareB);
      setCopiedShareB(true);
      setTimeout(() => setCopiedShareB(false), 2500);
    }
  };

  return (
    <div className="bg-obsidian-900 border border-obsidian-700/60 rounded-2xl p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Client-Side Sovereign Vault (AES-256-GCM)
            </h3>
            <p className="text-xs text-slate-400">
              Plaintext directives are split into two mathematical shares ($S_A \oplus S_B$). The network never sees your raw keys.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPlaintext(!showPlaintext)}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-mono"
        >
          {showPlaintext ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{showPlaintext ? "Mask" : "View"}</span>
        </button>
      </div>

      {/* Note Textarea */}
      <div className="mb-4">
        <label className="text-xs font-mono text-slate-400 block mb-1.5 uppercase tracking-wider">
          Estate Directives & Master Seeds
        </label>
        <textarea
          rows={4}
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          disabled={!!splitResult}
          className={`w-full bg-obsidian-950 border rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none transition-all ${
            showPlaintext ? '' : 'filter blur-[3px] hover:blur-none transition-all duration-300'
          } ${splitResult ? 'border-cyber-emerald/40 opacity-75' : 'border-obsidian-700 focus:border-cyber-cyan'}`}
          placeholder="Enter sensitive directives, recovery phrases, or private notes..."
        />
      </div>

      {/* Beneficiary Configuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div>
          <label className="text-[11px] font-mono text-slate-400 block mb-1">BENEFICIARY NEAR ACCOUNT</label>
          <input
            type="text"
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            disabled={!!splitResult}
            className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyber-cyan"
          />
        </div>
        <div>
          <label className="text-[11px] font-mono text-slate-400 block mb-1">BENEFICIARY TELEGRAM (FOR DISPATCH)</label>
          <input
            type="text"
            value={beneficiaryTg}
            onChange={(e) => setBeneficiaryTg(e.target.value)}
            disabled={!!splitResult}
            className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyber-cyan"
          />
        </div>
      </div>

      {!splitResult ? (
        <button
          onClick={handleEncryptAndSeal}
          disabled={isEncrypting || !plaintext}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-scarlet-600 to-scarlet-500 hover:from-scarlet-500 hover:to-scarlet-400 text-white font-medium py-2.5 rounded-xl transition-all shadow-scarlet-glow text-xs uppercase tracking-wider cursor-pointer"
        >
          <KeyRound className="w-4 h-4" />
          <span>{isEncrypting ? "Encrypting with AES-256-GCM..." : "Seal Vault & Split Key Shares"}</span>
        </button>
      ) : (
        <div className="bg-obsidian-950/80 border border-cyber-emerald/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-cyber-emerald flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" />
              VAULT SEALED (256-BIT XOR SPLIT APPLIED)
            </span>
            <span className="text-[10px] font-mono text-slate-400">IV: {splitResult.iv}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {/* Share A */}
            <div className="bg-obsidian-900 border border-obsidian-700 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Share A (Contract Locked)
              </span>
              <p className="text-slate-300 truncate">{splitResult.shareA}</p>
              <span className="text-[10px] text-cyber-cyan mt-1 block">
                🔒 Locked in NEAR contract until Proof-of-Absence
              </span>
            </div>

            {/* Share B */}
            <div className="bg-obsidian-900 border border-obsidian-700 rounded-lg p-2.5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Share B (Heir Share)
                </span>
                <button
                  onClick={copyShareB}
                  className="text-cyber-cyan hover:text-white flex items-center gap-1 text-[11px]"
                >
                  {copiedShareB ? <Check className="w-3 h-3 text-cyber-emerald" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedShareB ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="text-slate-300 truncate">{splitResult.shareB}</p>
              <span className="text-[10px] text-cyber-emerald mt-1 block">
                🗝️ Hand this share to your heir or emergency legal contact
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
