import { Layers3 } from "lucide-react";

export function Contours() {
  return (
    <svg viewBox="0 0 400 250" aria-hidden="true" className="contours">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path
            key={i}
            d={`M ${-50 + i * 15} ${210 - i * 20} C ${70 + i * 8} ${290 - i * 25},${95 + i * 12} ${20 + i * 10},${230 + i * 12} ${65 + i * 7} S ${345 + i * 10} ${220 - i * 5},460 ${110 - i * 10}`}
          />
        ))}
      </g>
    </svg>
  );
}
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={"brand " + (small ? "small" : "")}>
      <span className="brand-icon">
        <Layers3 size={small ? 17 : 23} />
      </span>
      {!small && (
        <span>
          SANKET<small>MINE INTELLIGENCE</small>
        </span>
      )}
    </span>
  );
}
