import { Skeleton } from "./ui/skeleton";

/**
 * Scoped loading placeholders.
 *
 * These replace the old full-screen blur overlay (removed from api/axios.js).
 * Each one is shaped like the real content it stands in for, so the page
 * doesn't "pop" when data arrives — only the section that's actually
 * fetching shows a placeholder, everything else on the page (nav, filters,
 * buttons) stays interactive immediately.
 *
 * Usage pattern in a page:
 *   const [loading, setLoading] = useState(true);
 *   useEffect(() => {
 *     api.get("/thing").then(r => setList(r.data)).finally(() => setLoading(false));
 *   }, []);
 *   ...
 *   {loading ? <ListSkeleton count={4} /> : list.map(...)}
 */

// A single job/worker/list-item style card — icon block + two lines + a pill.
export function CardSkeleton() {
  return (
    <div className="bg-white border-2 border-[#E2E8F0] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

// Repeats CardSkeleton, e.g. for job feeds / worker lists / applicant lists.
export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3" data-testid="list-skeleton">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

// Compact single-line row — for invites/applications/history rows that are
// simpler than a full card.
export function RowSkeleton() {
  return (
    <div className="bg-white border-2 border-[#E2E8F0] rounded-xl p-3 flex items-center gap-3">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
    </div>
  );
}

export function RowListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-2" data-testid="row-list-skeleton">
      {Array.from({ length: count }).map((_, i) => <RowSkeleton key={i} />)}
    </div>
  );
}

// Stat strip — e.g. "12 jobs · 4.5 avg rating · 8 completed" headers used on
// History/Reviews pages.
export function StatBarSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }} data-testid="statbar-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border-2 border-[#E2E8F0] rounded-xl p-3 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

// Profile/passport style block — avatar + name + a few detail rows.
export function PassportSkeleton() {
  return (
    <div className="bg-white border-2 border-[#E2E8F0] rounded-xl p-4 space-y-4" data-testid="passport-skeleton">
      <div className="flex items-center gap-3">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// Quiz/skill-test style block — a question + answer options.
export function QuizSkeleton() {
  return (
    <div className="bg-white border-2 border-[#E2E8F0] rounded-xl p-4 space-y-3" data-testid="quiz-skeleton">
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-2 pt-1">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    </div>
  );
}
