
from datetime import datetime, timezone

# ---- City tiers -----------------------------------------------------------
# Tier 1: metro/high cost-of-living markets where going rates run highest.
TIER1_CITIES = {
    "mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "hyderabad",
    "chennai", "kolkata", "pune", "ahmedabad", "gurgaon", "gurugram",
    "noida", "navi mumbai",
}

# Tier 2: other large cities / state capitals — solid urban markets, but
# rates run below the metros above.
TIER2_CITIES = {
    "jaipur", "lucknow", "chandigarh", "bhopal", "indore", "nagpur",
    "kanpur", "surat", "vadodara", "coimbatore", "kochi", "cochin",
    "visakhapatnam", "vizag", "patna", "bhubaneswar", "guwahati",
    "dehradun", "raipur", "ranchi", "amritsar", "ludhiana", "nashik",
    "vijayawada", "mysuru", "mysore", "madurai", "jodhpur", "agra",
    "varanasi", "meerut", "faridabad", "rajkot", "thiruvananthapuram",
    "trivandrum", "jamshedpur", "allahabad", "prayagraj", "aurangabad",
    "srinagar", "jabalpur", "gwalior",
}

# Anything not in the two sets above is treated as Tier 3 — smaller towns
# and rural markets, where going rates run lowest.


def get_city_tier(city: str) -> str:
    c = (city or "").strip().lower()
    if c in TIER1_CITIES:
        return "tier1"
    if c in TIER2_CITIES:
        return "tier2"
    return "tier3"


# Multiplier applied to the Tier-1 base range for each tier.
TIER_MULTIPLIERS = {
    "tier1": 1.0,
    "tier2": 0.78,   # ~22% below metro rates
    "tier3": 0.6,    # ~40% below metro rates — small towns / rural
}

TIER_LABELS = {
    "tier1": "metro",
    "tier2": "city",
    "tier3": "small town / rural",
}

# ---- Skill typical price ---------------------------------------------------
# A single typical fair price (₹) for that skill's job in a Tier-1 city, in
# an average-demand month. The suggested range shown to users is a tight
# band around this number (see BAND_HALF_WIDTH below), not a wide min/max —
# a ±150 spread is far more actionable than a swing from ₹700 to ₹3500.
SKILL_TYPICAL_PRICE = {
    "Plumber":                 1200,
    "Electrician":             1800,
    "Painter":                 3200,
    "Mason":                   2800,
    "Carpenter":               2500,
    "Driver":                  1000,
    "Helper":                   700,
    "AC Technician":           1600,
    "Welder":                  1800,
    "Gardener":                 800,
    "Cook":                    1100,
    "Security Guard":          1000,
    "Cleaner / Sweeper":        650,
    "Tailor":                  1100,
    "Beautician":              1300,
    "Delivery Boy":             600,
    "Caretaker / Nurse":       1600,
    "Tutor / Teacher":         1300,
    "Mechanic":                1600,
    "Tiler":                   2800,
    "Waterproofing Expert":    3200,
    "Glass / Aluminium Worker": 2200,
    "Lift Technician":         2800,
    "CCTV Technician":         1900,
    "Solar Panel Technician":  3500,
}

DEFAULT_TYPICAL_PRICE = 1300  # fallback for any skill not in the table above

# Half-width (₹) of the suggested band around the typical price, applied
# after tier and seasonal adjustment — keeps every suggestion a tight,
# actionable ~₹300 spread instead of a wide swing.
BAND_HALF_WIDTH = 150


# ---- Seasonal demand factors ------------------------------------------------
# Multipliers applied on top of the base range for the current month, by
# skill category. Grouped rather than per-skill to keep this maintainable.
def _season_for_skill(skill: str, month: int):
    """Returns (multiplier, label) for a skill in a given calendar month (1-12)."""
    s = (skill or "").lower()

    # Wedding / festive season (Oct-Dec, Apr-Jun): painters, tailors, beauticians,
    # decorators-adjacent trades see a demand spike.
    festive_wedding = month in (10, 11, 12, 4, 5, 6)
    if any(k in s for k in ("painter", "tailor", "beautician")):
        if festive_wedding:
            return 1.18, "Wedding/festive season demand"
        return 1.0, None

    # Summer (Mar-Jun): AC & cooling-related trades spike.
    summer = month in (3, 4, 5, 6)
    if any(k in s for k in ("ac technician", "electrician", "solar")):
        if summer:
            return 1.15, "Summer cooling/power demand"
        if month in (10, 11):  # Diwali rewiring/lighting rush
            return 1.1, "Diwali season demand"
        return 1.0, None

    # Monsoon (Jul-Sep): outdoor/construction-heavy trades slow down;
    # waterproofing spikes.
    monsoon = month in (7, 8, 9)
    if "waterproof" in s:
        if monsoon:
            return 1.2, "Monsoon waterproofing demand"
        return 1.0, None
    if any(k in s for k in ("mason", "tiler", "carpenter", "welder", "glass", "gardener")):
        if monsoon:
            return 0.9, "Monsoon slowdown for outdoor work"
        return 1.0, None

    return 1.0, None


def suggest_price(skill: str, city: str, when: datetime = None) -> dict:
    when = when or datetime.now(timezone.utc)
    tier = get_city_tier(city)
    typical = SKILL_TYPICAL_PRICE.get(skill, DEFAULT_TYPICAL_PRICE)

    tier_mult = TIER_MULTIPLIERS[tier]
    season_mult, season_label = _season_for_skill(skill, when.month)

    adjusted = typical * tier_mult * season_mult
    mid = round(adjusted / 50) * 50   # round to nearest ₹50 first, so the band stays exactly ₹300 wide
    suggested_min = max(0, mid - BAND_HALF_WIDTH)
    suggested_max = mid + BAND_HALF_WIDTH

    return {
        "skill": skill,
        "city": city,
        "city_tier": tier,
        "city_tier_label": TIER_LABELS[tier],
        "suggested_min": int(suggested_min),
        "suggested_max": int(suggested_max),
        "seasonal_factor": season_mult,
        "seasonal_note": season_label,
    }


def rate_budget(skill: str, city: str, budget: int, when: datetime = None) -> dict:
    """Classifies an existing job's budget against the suggested range.
    Used to show workers a fair-pay indicator on job listings."""
    suggestion = suggest_price(skill, city, when)
    lo, hi = suggestion["suggested_min"], suggestion["suggested_max"]
    if budget < lo * 0.85:
        verdict = "below_market"
    elif budget > hi * 1.15:
        verdict = "above_market"
    else:
        verdict = "fair"
    return {**suggestion, "verdict": verdict}