"use client";

import { useMemo, useState } from "react";

type ActivityPriority = "must" | "want" | "maybe";

type Activity = {
  id: string;
  time: string;
  title: string;
  location: string;
  cost: number;
  type: "activity" | "food" | "ski" | "transport" | "wellness" | "stay";
  booked: boolean;
  priority: ActivityPriority;
};

type DayPlan = {
  id: string;
  label: string;
  date: string;
  weather: string;
  location: string;
  activities: Activity[];
};

type HotelOption = {
  id: string;
  name: string;
  tagline: string;
  nightlyRate: number;
  totalEstimate: number;
  highlights: string[];
  bestFor: string;
  badge: string;
};

type BudgetItem = {
  id: string;
  category: string;
  estimated: number;
  actual: number;
  icon: "plane" | "hotel" | "ski" | "food" | "activity" | "car";
};

type PackingItem = {
  id: string;
  item: string;
  category: string;
  packed: boolean;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const steps = ["Trip Wizard", "Itinerary Planner", "Mobile Itinerary"];

const styleOptions = [
  "Alpine Luxe",
  "Chalet Cozy",
  "Adventure",
  "Art + Culture"
];

const paceOptions = ["Relaxed", "Balanced", "High Energy"];

const priorityOptions = [
  "Skiing",
  "Wellness",
  "Food",
  "Family",
  "Scenery",
  "Culture"
];

const hotelOptions: HotelOption[] = [
  {
    id: "kulm",
    name: "Kulm Hotel St. Moritz",
    tagline: "Iconic lakeside luxury with ski-in access",
    nightlyRate: 680,
    totalEstimate: 3400,
    highlights: [
      "Grand lake views with alpine spa",
      "Ski passes included for guests",
      "Indoor pool + family concierge"
    ],
    bestFor: "Luxury-first stays with effortless logistics",
    badge: "Ski Pass Included"
  },
  {
    id: "suvretta",
    name: "Suvretta House",
    tagline: "Classic chalet grandeur with private lifts",
    nightlyRate: 540,
    totalEstimate: 2700,
    highlights: [
      "Private ski lift to Corviglia",
      "Heated outdoor pool + wellness circuit",
      "Spacious suites for families"
    ],
    bestFor: "Space, serenity, and ski convenience",
    badge: "Family Favorite"
  },
  {
    id: "crystal",
    name: "Crystal Hotel",
    tagline: "Boutique energy in the village core",
    nightlyRate: 310,
    totalEstimate: 1550,
    highlights: [
      "Walkable to boutiques and cafes",
      "Cozy lounge and fireplace vibe",
      "Great value without sacrificing style"
    ],
    bestFor: "Central access with a lighter budget",
    badge: "Best Value"
  }
];

const initialDays: DayPlan[] = [
  {
    id: "day-1",
    label: "Arrival + Lake Stroll",
    date: "Feb 22, 2026",
    weather: "Light snow, 26F",
    location: "St. Moritz Dorf",
    activities: [
      {
        id: "arrive",
        time: "09:30",
        title: "Land in Zurich",
        location: "ZRH Airport",
        cost: 0,
        type: "transport",
        booked: true,
        priority: "must"
      },
      {
        id: "train",
        time: "11:30",
        title: "Scenic Glacier Express transfer",
        location: "Zurich to St. Moritz",
        cost: 520,
        type: "transport",
        booked: true,
        priority: "must"
      },
      {
        id: "checkin",
        time: "16:30",
        title: "Check in at hotel",
        location: "Hotel",
        cost: 0,
        type: "stay",
        booked: false,
        priority: "must"
      },
      {
        id: "walk",
        time: "18:00",
        title: "Lakefront stroll + village photos",
        location: "Lake St. Moritz",
        cost: 0,
        type: "activity",
        booked: false,
        priority: "want"
      },
      {
        id: "dinner",
        time: "19:30",
        title: "Welcome dinner at Chesa Veglia",
        location: "Via Veglia",
        cost: 280,
        type: "food",
        booked: false,
        priority: "want"
      }
    ]
  },
  {
    id: "day-2",
    label: "Corviglia Ski Day",
    date: "Feb 23, 2026",
    weather: "Sunny, 28F",
    location: "Corviglia",
    activities: [
      {
        id: "gear",
        time: "08:00",
        title: "Ski gear pickup + breakfast",
        location: "Hotel lobby",
        cost: 180,
        type: "ski",
        booked: true,
        priority: "must"
      },
      {
        id: "ski",
        time: "09:30",
        title: "Morning ski session",
        location: "Corviglia slopes",
        cost: 0,
        type: "ski",
        booked: false,
        priority: "must"
      },
      {
        id: "lunch",
        time: "12:30",
        title: "Alpine lunch at El Paradiso",
        location: "Suot San Murezzan",
        cost: 160,
        type: "food",
        booked: false,
        priority: "want"
      },
      {
        id: "spa",
        time: "16:30",
        title: "Recovery spa circuit",
        location: "Hotel Spa",
        cost: 120,
        type: "wellness",
        booked: false,
        priority: "want"
      }
    ]
  },
  {
    id: "day-3",
    label: "Morteratsch + Fondue",
    date: "Feb 24, 2026",
    weather: "Snow flurries, 24F",
    location: "Morteratsch",
    activities: [
      {
        id: "train-glacier",
        time: "09:00",
        title: "Bernina train to Morteratsch",
        location: "St. Moritz Station",
        cost: 120,
        type: "transport",
        booked: true,
        priority: "must"
      },
      {
        id: "hike",
        time: "10:30",
        title: "Glacier viewpoint walk",
        location: "Morteratsch trail",
        cost: 0,
        type: "activity",
        booked: false,
        priority: "want"
      },
      {
        id: "fondue",
        time: "19:00",
        title: "Fondue evening at Lej da Staz",
        location: "Lej da Staz",
        cost: 220,
        type: "food",
        booked: false,
        priority: "want"
      }
    ]
  },
  {
    id: "day-4",
    label: "Wellness + Shopping",
    date: "Feb 25, 2026",
    weather: "Clear, 30F",
    location: "St. Moritz Dorf",
    activities: [
      {
        id: "sleep",
        time: "09:30",
        title: "Slow morning breakfast",
        location: "Hotel",
        cost: 80,
        type: "food",
        booked: false,
        priority: "want"
      },
      {
        id: "wellness",
        time: "11:00",
        title: "Private wellness booking",
        location: "Hotel Spa",
        cost: 240,
        type: "wellness",
        booked: false,
        priority: "want"
      },
      {
        id: "shopping",
        time: "15:00",
        title: "Boutique stroll + hot chocolate",
        location: "Via Serlas",
        cost: 140,
        type: "activity",
        booked: false,
        priority: "maybe"
      }
    ]
  },
  {
    id: "day-5",
    label: "Lake + Culture",
    date: "Feb 26, 2026",
    weather: "Cloudy, 27F",
    location: "St. Moritz Dorf",
    activities: [
      {
        id: "museum",
        time: "10:00",
        title: "Segantini Museum visit",
        location: "Via Somplaz",
        cost: 70,
        type: "activity",
        booked: false,
        priority: "maybe"
      },
      {
        id: "lake-loop",
        time: "13:00",
        title: "Lake loop + coffee stop",
        location: "Lake St. Moritz",
        cost: 60,
        type: "activity",
        booked: false,
        priority: "want"
      },
      {
        id: "farewell",
        time: "19:00",
        title: "Farewell dinner tasting menu",
        location: "Via Serlas",
        cost: 320,
        type: "food",
        booked: false,
        priority: "want"
      }
    ]
  },
  {
    id: "day-6",
    label: "Departure",
    date: "Feb 27, 2026",
    weather: "Snowy, 25F",
    location: "St. Moritz Dorf",
    activities: [
      {
        id: "breakfast",
        time: "08:30",
        title: "Final alpine breakfast",
        location: "Hotel",
        cost: 90,
        type: "food",
        booked: false,
        priority: "want"
      },
      {
        id: "checkout",
        time: "10:30",
        title: "Check out and transfer",
        location: "Hotel",
        cost: 110,
        type: "transport",
        booked: false,
        priority: "must"
      },
      {
        id: "flight-home",
        time: "14:00",
        title: "Flight home",
        location: "Zurich Airport",
        cost: 0,
        type: "transport",
        booked: true,
        priority: "must"
      }
    ]
  }
];

const initialBudget: BudgetItem[] = [
  { id: "flights", category: "Flights + rail", estimated: 3200, actual: 3200, icon: "plane" },
  { id: "hotel", category: "Hotel (5 nights)", estimated: 2700, actual: 0, icon: "hotel" },
  { id: "ski", category: "Ski passes (5 days)", estimated: 1600, actual: 0, icon: "ski" },
  { id: "food", category: "Dining + cafes", estimated: 1400, actual: 0, icon: "food" },
  { id: "activity", category: "Activities + spa", estimated: 900, actual: 0, icon: "activity" },
  { id: "car", category: "Local transport", estimated: 450, actual: 0, icon: "car" }
];

const initialPacking: PackingItem[] = [
  { id: "pack-1", item: "Thermal base layers", category: "Essentials", packed: false },
  { id: "pack-2", item: "Ski goggles", category: "Ski", packed: true },
  { id: "pack-3", item: "Snow boots", category: "Essentials", packed: false },
  { id: "pack-4", item: "Swimwear for spa", category: "Wellness", packed: false },
  { id: "pack-5", item: "Camera + batteries", category: "Tech", packed: true }
];

const priorityStyles: Record<ActivityPriority, string> = {
  must: "bg-rose-100 text-rose-700",
  want: "bg-amber-100 text-amber-700",
  maybe: "bg-slate-100 text-slate-600"
};

const iconMap: Record<BudgetItem["icon"], JSX.Element> = {
  plane: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-sky-500">
      <path
        d="M3 12l18-6-6 18-2-6-6-2z"
        fill="currentColor"
      />
    </svg>
  ),
  hotel: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-violet-500">
      <path
        d="M4 6h6a4 4 0 0 1 4 4v6H4V6zm10 4h6v6h-6v-6z"
        fill="currentColor"
      />
    </svg>
  ),
  ski: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-cyan-500">
      <path
        d="M7 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 20l16-6"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  food: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-rose-500">
      <path
        d="M7 2v8M11 2v8M9 2v8m8-8v8m2-8v8M6 12h12v10H6z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-500">
      <path
        d="M12 3l8 4-8 4-8-4 8-4zm8 8v6l-8 4-8-4v-6"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  car: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-500">
      <path
        d="M3 14l2-6h14l2 6v5h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3v-5z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
};

function DayCard({
  day,
  onUpdate
}: {
  day: DayPlan;
  onUpdate: (day: DayPlan) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState({
    time: "12:00",
    title: "",
    location: "",
    cost: "",
    priority: "want" as ActivityPriority
  });

  const dayTotal = day.activities.reduce((total, activity) => total + activity.cost, 0);

  const addActivity = () => {
    if (!draft.title.trim()) return;
    const newActivity: Activity = {
      id: `custom-${Date.now()}`,
      time: draft.time || "12:00",
      title: draft.title.trim(),
      location: draft.location.trim() || "St. Moritz",
      cost: draft.cost ? Number(draft.cost) : 0,
      type: "activity",
      booked: false,
      priority: draft.priority
    };
    onUpdate({
      ...day,
      activities: [...day.activities, newActivity].sort((a, b) =>
        a.time.localeCompare(b.time)
      )
    });
    setDraft({ time: "12:00", title: "", location: "", cost: "", priority: "want" });
    setIsAdding(false);
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate">{day.date}</p>
          <h3 className="text-lg font-semibold text-ink">{day.label}</h3>
          <p className="text-xs text-slate">{day.location} - {day.weather}</p>
        </div>
        <div className="text-right text-xs text-slate">
          <p className="uppercase tracking-wide text-slate/70">Day spend</p>
          <p className="text-sm font-semibold text-ink">{currency.format(dayTotal)}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {day.activities.map((activity) => (
          <div
            key={activity.id}
            className="flex flex-wrap items-start gap-3 rounded-xl border border-black/5 bg-white p-3 shadow-sm"
          >
            <input
              type="checkbox"
              checked={activity.booked}
              onChange={() =>
                onUpdate({
                  ...day,
                  activities: day.activities.map((item) =>
                    item.id === activity.id
                      ? { ...item, booked: !item.booked }
                      : item
                  )
                })
              }
              className="mt-1 h-4 w-4 accent-moss"
            />
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink">{activity.time}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityStyles[activity.priority]}`}
                >
                  {activity.priority.toUpperCase()}
                </span>
                {activity.booked ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    BOOKED
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-ink">{activity.title}</p>
              <p className="text-xs text-slate">{activity.location}</p>
            </div>
            <div className="text-xs font-semibold text-ink">
              {activity.cost ? currency.format(activity.cost) : "--"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        {isAdding ? (
          <div className="rounded-xl border border-dashed border-moss/30 bg-mist/70 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <input
                value={draft.time}
                onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-ink"
                placeholder="Time"
              />
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-ink sm:col-span-2"
                placeholder="Activity title"
              />
              <input
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-ink"
                placeholder="Location"
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input
                value={draft.cost}
                onChange={(event) => setDraft({ ...draft, cost: event.target.value })}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-ink"
                placeholder="Cost"
                type="number"
              />
              <select
                value={draft.priority}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    priority: event.target.value as ActivityPriority
                  })
                }
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-ink"
              >
                <option value="must">Must</option>
                <option value="want">Want</option>
                <option value="maybe">Maybe</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addActivity}
                  className="flex-1 rounded-lg bg-moss px-3 py-2 text-xs font-semibold text-white"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full rounded-xl border border-dashed border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate hover:border-moss/40 hover:text-moss"
          >
            Add an activity
          </button>
        )}
      </div>
    </div>
  );
}

export default function TravelPlannerPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [wizard, setWizard] = useState({
    destination: "St. Moritz, Switzerland",
    startDate: "2026-02-22",
    endDate: "2026-02-27",
    travelers: 4,
    budget: 12000,
    style: "Alpine Luxe",
    pace: "Balanced",
    priorities: ["Skiing", "Wellness", "Food", "Family"]
  });
  const [days, setDays] = useState<DayPlan[]>(initialDays);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(initialBudget);
  const [packingItems, setPackingItems] = useState<PackingItem[]>(initialPacking);
  const [packingDraft, setPackingDraft] = useState({
    item: "",
    category: "Essentials"
  });
  const [mobileDayId, setMobileDayId] = useState(initialDays[0].id);

  const tripNights = useMemo(() => {
    const start = new Date(wizard.startDate).getTime();
    const end = new Date(wizard.endDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
    return Math.round((end - start) / (1000 * 60 * 60 * 24));
  }, [wizard.startDate, wizard.endDate]);

  const allActivities = useMemo(
    () => days.flatMap((day) => day.activities),
    [days]
  );
  const bookedCount = allActivities.filter((activity) => activity.booked).length;
  const mustCount = allActivities.filter((activity) => activity.priority === "must").length;
  const totalEstimated = budgetItems.reduce((total, item) => total + item.estimated, 0);
  const totalActual = budgetItems.reduce((total, item) => total + item.actual, 0);
  const budgetPercent = totalEstimated
    ? Math.min(Math.round((totalActual / totalEstimated) * 100), 100)
    : 0;
  const remaining = totalEstimated - totalActual;
  const dayCosts = days.map((day) =>
    day.activities.reduce((total, activity) => total + activity.cost, 0)
  );
  const minDayCost = dayCosts.length ? Math.min(...dayCosts) : 0;
  const maxDayCost = dayCosts.length ? Math.max(...dayCosts) : 0;

  const packingCategories = Array.from(
    new Set(packingItems.map((item) => item.category))
  );
  const packedCount = packingItems.filter((item) => item.packed).length;

  const selectedHotel = hotelOptions.find((hotel) => hotel.id === selectedHotelId) || null;

  const handleHotelSelect = (hotelId: string) => {
    const hotel = hotelOptions.find((option) => option.id === hotelId);
    if (!hotel) return;
    setSelectedHotelId(hotelId);
    setBudgetItems((items) =>
      items.map((item) => {
        if (item.id === "hotel") {
          return {
            ...item,
            category: `${hotel.name} (5 nights)`,
            estimated: hotel.totalEstimate
          };
        }
        if (item.id === "ski") {
          return {
            ...item,
            category:
              hotel.id === "kulm" ? "Ski passes (included)" : "Ski passes (5 days)",
            estimated: hotel.id === "kulm" ? 0 : 1600
          };
        }
        return item;
      })
    );
    setDays((current) =>
      current.map((day) => ({
        ...day,
        activities: day.activities.map((activity) => {
          if (activity.id === "checkin") {
            return {
              ...activity,
              title: `Check in at ${hotel.name}`,
              location: hotel.name
            };
          }
          if (activity.location === "Hotel" || activity.location === "Hotel Spa") {
            return { ...activity, location: hotel.name };
          }
          return activity;
        })
      }))
    );
  };

  const togglePriority = (priority: string) => {
    setWizard((current) => {
      if (current.priorities.includes(priority)) {
        return {
          ...current,
          priorities: current.priorities.filter((item) => item !== priority)
        };
      }
      return { ...current, priorities: [...current.priorities, priority] };
    });
  };

  const addPackingItem = () => {
    if (!packingDraft.item.trim()) return;
    setPackingItems((items) => [
      ...items,
      {
        id: `pack-${Date.now()}`,
        item: packingDraft.item.trim(),
        category: packingDraft.category,
        packed: false
      }
    ]);
    setPackingDraft({ item: "", category: packingDraft.category });
  };

  const mobileDay = days.find((day) => day.id === mobileDayId) || days[0];

  return (
    <main className="flex flex-1 flex-col gap-8">
      <header className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/90 p-8 shadow-sm">
        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-clay/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 top-28 h-64 w-64 rounded-full bg-moss/10 blur-3xl" />
        <div className="relative space-y-4">
          <span className="badge">St. Moritz winter edition</span>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold text-ink sm:text-5xl">
              Alpine travel planner with a guided wizard, dynamic itinerary, and mobile
              itinerary site.
            </h1>
            <p className="max-w-2xl text-lg text-slate">
              Build a trip in minutes, fine-tune the schedule by day, then share a
              lightweight mobile view for everyone on the trip.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate">
            <span className="rounded-full border border-black/10 bg-white px-3 py-1">
              Wizard-based preferences
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1">
              Hotel + budget sync
            </span>
            <span className="rounded-full border border-black/10 bg-white px-3 py-1">
              Mobile-ready itinerary
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <button
            key={step}
            type="button"
            onClick={() => setActiveStep(index)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              activeStep === index
                ? "border-moss bg-moss text-white shadow-sm"
                : "border-black/10 bg-white/80 text-ink hover:border-moss/40"
            }`}
          >
            <p className="text-[11px] uppercase tracking-wide opacity-70">
              Step {index + 1}
            </p>
            <p className="text-lg font-semibold">{step}</p>
          </button>
        ))}
      </div>

      {activeStep === 0 ? (
        <section className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
            <div className="container-card space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-ink">Trip wizard</h2>
                <p className="text-sm text-slate">
                  Capture the core preferences and generate a starting itinerary
                  automatically.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-ink">
                  Destination
                  <input
                    value={wizard.destination}
                    onChange={(event) =>
                      setWizard({ ...wizard, destination: event.target.value })
                    }
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-ink">
                  Travelers
                  <input
                    type="number"
                    value={wizard.travelers}
                    onChange={(event) =>
                      setWizard({
                        ...wizard,
                        travelers: Number(event.target.value)
                      })
                    }
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-ink">
                  Start date
                  <input
                    type="date"
                    value={wizard.startDate}
                    onChange={(event) =>
                      setWizard({ ...wizard, startDate: event.target.value })
                    }
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-ink">
                  End date
                  <input
                    type="date"
                    value={wizard.endDate}
                    onChange={(event) =>
                      setWizard({ ...wizard, endDate: event.target.value })
                    }
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-ink sm:col-span-2">
                  Budget target
                  <input
                    type="number"
                    value={wizard.budget}
                    onChange={(event) =>
                      setWizard({ ...wizard, budget: Number(event.target.value) })
                    }
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-ink">Travel style</p>
                <div className="flex flex-wrap gap-2">
                  {styleOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setWizard({ ...wizard, style: option })}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        wizard.style === option
                          ? "border-moss bg-moss text-white"
                          : "border-black/10 bg-white text-slate hover:border-moss/40"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-ink">Daily pace</p>
                <div className="flex flex-wrap gap-2">
                  {paceOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setWizard({ ...wizard, pace: option })}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        wizard.pace === option
                          ? "border-moss bg-moss text-white"
                          : "border-black/10 bg-white text-slate hover:border-moss/40"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-ink">Priorities</p>
                <div className="flex flex-wrap gap-2">
                  {priorityOptions.map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => togglePriority(priority)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        wizard.priorities.includes(priority)
                          ? "border-ink bg-ink text-white"
                          : "border-black/10 bg-white text-slate hover:border-moss/40"
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-white"
              >
                Generate itinerary
              </button>
            </div>

            <div className="space-y-6">
              <div className="container-card space-y-4">
                <h3 className="text-xl font-semibold text-ink">Trip snapshot</h3>
                <div className="grid gap-3 text-sm text-slate">
                  <div className="flex items-center justify-between">
                    <span>Destination</span>
                    <span className="font-semibold text-ink">{wizard.destination}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Trip length</span>
                    <span className="font-semibold text-ink">
                      {tripNights ? `${tripNights} nights` : "Select dates"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Travelers</span>
                    <span className="font-semibold text-ink">
                      {wizard.travelers} people
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Budget target</span>
                    <span className="font-semibold text-ink">
                      {currency.format(wizard.budget)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Style</span>
                    <span className="font-semibold text-ink">{wizard.style}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pace</span>
                    <span className="font-semibold text-ink">{wizard.pace}</span>
                  </div>
                </div>
              </div>

              <div className="container-card space-y-4">
                <h3 className="text-xl font-semibold text-ink">Priority mix</h3>
                <div className="space-y-3 text-sm text-slate">
                  {wizard.priorities.map((priority) => (
                    <div
                      key={priority}
                      className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2"
                    >
                      <span>{priority}</span>
                      <span className="text-xs font-semibold text-ink">
                        {priority === "Skiing" ? "High" : "Medium"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-dashed border-black/10 bg-mist/60 p-3 text-xs text-slate">
                  This mix is used to pre-fill the itinerary planner with must-do
                  activities, dining, and wellness blocks.
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeStep === 1 ? (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Total activities", value: allActivities.length, tone: "text-sky-700" },
              { label: "Booked", value: bookedCount, tone: "text-emerald-700" },
              { label: "Must-do items", value: mustCount, tone: "text-rose-700" },
              {
                label: "Est. daily cost",
                value: `${currency.format(minDayCost)} - ${currency.format(maxDayCost)}`,
                tone: "text-slate"
              }
            ].map((item) => (
              <div key={item.label} className="container-card">
                <p className="text-[11px] uppercase tracking-wide text-slate/80">
                  {item.label}
                </p>
                <p className={`mt-2 text-lg font-semibold ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-4">
              {days.map((day) => (
                <DayCard
                  key={day.id}
                  day={day}
                  onUpdate={(updated) =>
                    setDays((current) =>
                      current.map((item) => (item.id === updated.id ? updated : item))
                    )
                  }
                />
              ))}
            </div>

            <div className="space-y-6">
              <div className="container-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-ink">Hotel options</h3>
                  <span className="text-xs text-slate">5 nights</span>
                </div>
                <p className="text-sm text-slate">
                  Select a hotel to sync the itinerary, ski passes, and budget forecast.
                </p>
                <div className="space-y-3">
                  {hotelOptions.map((hotel) => {
                    const isSelected = selectedHotelId === hotel.id;
                    return (
                      <div
                        key={hotel.id}
                        className={`rounded-2xl border p-4 transition ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-50/50"
                            : "border-black/10 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {hotel.name}
                            </p>
                            <p className="text-xs text-slate">{hotel.tagline}</p>
                          </div>
                          <span className="rounded-full bg-moss px-2 py-1 text-[10px] font-semibold text-white">
                            {hotel.badge}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate">
                          <div className="flex items-center justify-between">
                            <span>Per night</span>
                            <span className="font-semibold text-ink">
                              {currency.format(hotel.nightlyRate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Total</span>
                            <span className="font-semibold text-ink">
                              {currency.format(hotel.totalEstimate)}
                            </span>
                          </div>
                        </div>
                        <ul className="mt-3 space-y-2 text-xs text-slate">
                          {hotel.highlights.map((highlight) => (
                            <li key={highlight} className="flex items-start gap-2">
                              <span className="mt-1 h-2 w-2 rounded-full bg-moss/60" />
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 rounded-xl border border-black/5 bg-mist/60 p-2 text-[11px] text-slate">
                          Best for: <span className="font-semibold text-ink">{hotel.bestFor}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => handleHotelSelect(hotel.id)}
                          className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold ${
                            isSelected
                              ? "border border-emerald-300 bg-white text-emerald-700"
                              : "bg-ink text-white"
                          }`}
                        >
                          {isSelected ? "Selected hotel" : "Select this hotel"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {selectedHotel ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800">
                    Itinerary synced with {selectedHotel.name}. Budget updated with
                    hotel + ski pass details.
                  </div>
                ) : null}
              </div>

              <div className="container-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-ink">Budget tracker</h3>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-slate/70">
                      Estimated total
                    </p>
                    <p className="text-lg font-semibold text-ink">
                      {currency.format(totalEstimated)}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-black/5 bg-white p-3">
                  <div className="flex items-center justify-between text-xs text-slate">
                    <span>
                      Spent: <span className="font-semibold text-ink">{currency.format(totalActual)}</span>
                    </span>
                    <span>
                      Remaining:{" "}
                      <span className="font-semibold text-emerald-700">
                        {currency.format(remaining)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-mist">
                    <div
                      className="h-2 rounded-full bg-moss"
                      style={{ width: `${budgetPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-right text-[11px] text-slate">
                    {budgetPercent}% of budget used
                  </p>
                </div>
                <div className="space-y-2">
                  {budgetItems.map((item) => {
                    const progress = item.estimated
                      ? Math.min(Math.round((item.actual / item.estimated) * 100), 100)
                      : 0;
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-black/5 bg-white p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mist">
                            {iconMap[item.icon]}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-ink">{item.category}</p>
                            <div className="mt-2 h-1.5 rounded-full bg-mist">
                              <div
                                className="h-1.5 rounded-full bg-ink"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          <input
                            type="number"
                            value={item.actual}
                            onChange={(event) =>
                              setBudgetItems((items) =>
                                items.map((entry) =>
                                  entry.id === item.id
                                    ? { ...entry, actual: Number(event.target.value) }
                                    : entry
                                )
                              )
                            }
                            className="w-24 rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-ink"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="container-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-ink">Packing list</h3>
                  <span className="text-xs text-slate">
                    {packedCount}/{packingItems.length} packed
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={packingDraft.item}
                    onChange={(event) =>
                      setPackingDraft({ ...packingDraft, item: event.target.value })
                    }
                    className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-ink"
                    placeholder="Add item"
                  />
                  <select
                    value={packingDraft.category}
                    onChange={(event) =>
                      setPackingDraft({ ...packingDraft, category: event.target.value })
                    }
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-ink"
                  >
                    {packingCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                  <button
                    type="button"
                    onClick={addPackingItem}
                    className="rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-3">
                  {packingCategories.map((category) => {
                    const items = packingItems.filter((item) => item.category === category);
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate">
                          <span className="font-semibold text-ink">{category}</span>
                          <span>
                            {items.filter((item) => item.packed).length}/{items.length}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {items.map((item) => (
                            <label
                              key={item.id}
                              className={`flex items-center gap-2 rounded-lg border border-black/5 bg-white px-3 py-2 text-xs text-slate ${
                                item.packed ? "line-through" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={item.packed}
                                onChange={() =>
                                  setPackingItems((items) =>
                                    items.map((entry) =>
                                      entry.id === item.id
                                        ? { ...entry, packed: !entry.packed }
                                        : entry
                                    )
                                  )
                                }
                                className="h-3.5 w-3.5 accent-moss"
                              />
                              {item.item}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeStep === 2 ? (
        <section className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
          <div className="space-y-6">
            <div className="container-card space-y-4">
              <h2 className="text-2xl font-semibold text-ink">Mobile itinerary site</h2>
              <p className="text-sm text-slate">
                Share a streamlined itinerary for the group. It keeps essentials visible
                on the move without the full planning dashboard.
              </p>
              <div className="flex flex-wrap gap-2">
                {days.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setMobileDayId(day.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      mobileDayId === day.id
                        ? "border-ink bg-ink text-white"
                        : "border-black/10 bg-white text-slate"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="container-card">
                <p className="text-xs uppercase tracking-wide text-slate">Shared</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  Mobile-friendly itinerary link
                </p>
                <p className="mt-2 text-sm text-slate">
                  Send to family, friends, or a driver so everyone stays aligned.
                </p>
              </div>
              <div className="container-card">
                <p className="text-xs uppercase tracking-wide text-slate">Offline notes</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  Key confirmations saved
                </p>
                <p className="mt-2 text-sm text-slate">
                  Hotel, tickets, and pickup details pinned for fast access.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveStep(0)}
              className="rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-slate"
            >
              Back to wizard
            </button>
          </div>

          <div className="flex justify-center">
            <div className="relative w-full max-w-xs">
              <div className="rounded-[2.75rem] border border-black/20 bg-ink p-3 shadow-xl">
                <div className="rounded-[2.3rem] bg-white p-4">
                  <div className="flex items-center justify-between text-[10px] text-slate">
                    <span>9:41 AM</span>
                    <span>LTE</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-mist/70 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate">
                        {mobileDay.date}
                      </p>
                      <p className="text-lg font-semibold text-ink">{mobileDay.label}</p>
                      <p className="text-xs text-slate">
                        {wizard.destination} - {mobileDay.weather}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate">
                      <div className="rounded-xl border border-black/5 bg-white px-2 py-2">
                        <p className="text-lg font-semibold text-ink">{bookedCount}</p>
                        Booked
                      </div>
                      <div className="rounded-xl border border-black/5 bg-white px-2 py-2">
                        <p className="text-lg font-semibold text-ink">
                          {currency.format(remaining)}
                        </p>
                        Left
                      </div>
                      <div className="rounded-xl border border-black/5 bg-white px-2 py-2">
                        <p className="text-lg font-semibold text-ink">
                          {mobileDay.activities.length}
                        </p>
                        Stops
                      </div>
                    </div>
                    <div className="space-y-2">
                      {mobileDay.activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="rounded-2xl border border-black/5 bg-white p-3 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-ink">
                              {activity.time}
                            </span>
                            <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] text-slate">
                              {activity.type}
                            </span>
                          </div>
                          <p className="mt-2 font-semibold text-ink">{activity.title}</p>
                          <p className="text-[11px] text-slate">{activity.location}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate">
                      <button
                        type="button"
                        className="rounded-xl border border-black/10 bg-white px-2 py-2 font-semibold text-ink"
                      >
                        Map
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-black/10 bg-white px-2 py-2 font-semibold text-ink"
                      >
                        Tickets
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-black/10 bg-white px-2 py-2 font-semibold text-ink"
                      >
                        Call
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate">
                Mobile view mirrors the live itinerary data.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
