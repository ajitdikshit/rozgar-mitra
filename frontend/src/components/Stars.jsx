import { Star } from "lucide-react";

export function StarDisplay({ stars = 0, size = 16 }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size}
              className={i <= Math.round(stars) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}/>
      ))}
    </div>
  );
}

export function StarPicker({ value, onChange, size = 32 }) {
  return (
    <div className="flex gap-1" data-testid="star-picker">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" data-testid={`star-${i}`}
                onClick={() => onChange(i)}
                className="active:scale-90 transition-transform">
          <Star size={size}
                className={i <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} strokeWidth={2}/>
        </button>
      ))}
    </div>
  );
}
