import React, { useMemo } from "react";

/**
 * Input de data rápido — campos separados (Ano / Mês / Dia).
 *
 * Resolve o problema do `<input type="date">` que exige rolar ano a ano
 * (impraticável pra chegar em 1970, especialmente no mobile).
 *
 * Saída (string ISO "YYYY", "YYYY-MM" ou "YYYY-MM-DD"):
 * - Só ano preenchido → "1970"
 * - Ano + mês         → "1970-03"
 * - Ano + mês + dia   → "1970-03-15"
 *
 * Aceita valores incompletos de fora (ex: editando um membro que já tem só "1985").
 *
 * Props:
 * - value: string ISO parcial (ex: "1970", "1970-03", "1970-03-15") ou ""
 * - onChange: (iso: string) => void  (sempre emite string válida ou "")
 * - required: força o usuário a preencher o ano antes de salvar
 * - id: id do input principal (pra label/htmlFor)
 * - className: classes extras aplicadas no container
 */
export interface QuickDateInputProps {
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  id?: string;
  className?: string;
  minYear?: number;
  maxYear?: number;
  labels?: { year?: string; month?: string; day?: string };
}

const MESES = [
  { v: "01", n: "Jan" },
  { v: "02", n: "Fev" },
  { v: "03", n: "Mar" },
  { v: "04", n: "Abr" },
  { v: "05", n: "Mai" },
  { v: "06", n: "Jun" },
  { v: "07", n: "Jul" },
  { v: "08", n: "Ago" },
  { v: "09", n: "Set" },
  { v: "10", n: "Out" },
  { v: "11", n: "Nov" },
  { v: "12", n: "Dez" },
];

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

export const QuickDateInput: React.FC<QuickDateInputProps> = ({
  value,
  onChange,
  required = false,
  id,
  className = "",
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  labels = { year: "Ano", month: "Mês", day: "Dia" },
}) => {
  // Parse do valor existente (aceita "YYYY", "YYYY-MM", "YYYY-MM-DD")
  const parsed = useMemo(() => {
    const parts = (value || "").split("-");
    return {
      year: parts[0] || "",
      month: parts[1] || "",
      day: parts[2] || "",
    };
  }, [value]);

  const yearNum = parseInt(parsed.year, 10) || 0;
  const monthNum = parseInt(parsed.month, 10) || 0;
  const maxDay = daysInMonth(yearNum, monthNum);

  const emit = (year: string, month: string, day: string) => {
    if (!year) {
      onChange("");
      return;
    }
    let iso = year;
    if (month) {
      iso += `-${month}`;
      if (day) iso += `-${day}`;
    }
    onChange(iso);
  };

  const onYear = (y: string) => {
    // Limita a 4 dígitos e ao range
    let v = y.replace(/\D/g, "").slice(0, 4);
    if (v.length === 4) {
      const n = parseInt(v, 10);
      if (n < minYear) v = String(minYear);
      if (n > maxYear) v = String(maxYear);
    }
    emit(v, parsed.month, parsed.day);
  };

  const onMonth = (m: string) => {
    // Se o dia atual não existe no novo mês, ajusta
    let day = parsed.day;
    if (m && day) {
      const max = daysInMonth(yearNum, parseInt(m, 10));
      if (parseInt(day, 10) > max) day = "";
    }
    emit(parsed.year, m, day);
  };

  const onDay = (d: string) => {
    emit(parsed.year, parsed.month, d);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* ANO — campo principal (number, aceita até 4 dígitos) */}
      <div className="flex-[2] min-w-0">
        <label
          htmlFor={id ? `${id}-year` : undefined}
          className="block text-[10px] font-bold uppercase tracking-wider text-[#8a8a70] mb-1"
        >
          {labels.year} {required && <span className="text-red-500">*</span>}
        </label>
        <input
          id={id ? `${id}-year` : undefined}
          type="number"
          inputMode="numeric"
          min={minYear}
          max={maxYear}
          step={1}
          placeholder="AAAA"
          value={parsed.year}
          onChange={(e) => onYear(e.target.value)}
          required={required}
          className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#e0e0d0] focus:ring-2 focus:ring-[#5a5a40]/30 outline-none text-[#2a2a20] font-bold text-base text-center"
        />
      </div>

      {/* MÊS — opcional */}
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id ? `${id}-month` : undefined}
          className="block text-[10px] font-bold uppercase tracking-wider text-[#8a8a70] mb-1"
        >
          {labels.month}
        </label>
        <select
          id={id ? `${id}-month` : undefined}
          value={parsed.month}
          onChange={(e) => onMonth(e.target.value)}
          className="w-full px-2 py-2.5 rounded-xl bg-white border border-[#e0e0d0] focus:ring-2 focus:ring-[#5a5a40]/30 outline-none text-[#2a2a20] font-semibold text-sm"
        >
          <option value="">—</option>
          {MESES.map((m) => (
            <option key={m.v} value={m.v}>
              {m.n}
            </option>
          ))}
        </select>
      </div>

      {/* DIA — opcional, depende do mês pra max */}
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id ? `${id}-day` : undefined}
          className="block text-[10px] font-bold uppercase tracking-wider text-[#8a8a70] mb-1"
        >
          {labels.day}
        </label>
        <select
          id={id ? `${id}-day` : undefined}
          value={parsed.day && parseInt(parsed.day, 10) <= maxDay ? parsed.day : ""}
          onChange={(e) => onDay(e.target.value)}
          disabled={!parsed.month}
          className="w-full px-2 py-2.5 rounded-xl bg-white border border-[#e0e0d0] focus:ring-2 focus:ring-[#5a5a40]/30 outline-none text-[#2a2a20] font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="">—</option>
          {Array.from({ length: maxDay }, (_, i) => {
            const d = String(i + 1).padStart(2, "0");
            return (
              <option key={d} value={d}>
                {i + 1}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
};

export default QuickDateInput;