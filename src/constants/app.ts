// ── App Constants ────────────────────────────────────────────
// Mock data and helper functions powering the entire Meridian frontend.
// Provides hardcoded trips, conversations, invoices, guide articles, channel connection
// flows, and other placeholder data used throughout the UI during development/demo.

import type {
  Conversation, CallLog, CallDetail,
  Plan, TeamMember, RoleDef, Channel, NotifSetting, OnboardingTask,
  GuideCard, GuideArticle, AgentFeedItem, ConnectPickItem, ConnectChannelView,
  BillingPeriod, TripStatusLabel, InvoiceItem, InvoiceDetail,
} from '../types/app';
import { TripStatus } from '../types/app';

// Real TripStatus enum values (from the backend) mapped to a display label + colors/gradient.
// This is the single source of truth for "what does `planning` look like in the UI" — used by
// AppContext.tsx, TripDetail.tsx, Trips.tsx, and Dashboard.tsx. Keyed as Record<TripStatus, ...>
// so TypeScript forces exhaustive coverage of every real backend status.
export const apiStatusMeta: Record<TripStatus, { display: TripStatusLabel; bg: string; fg: string; gradient: string }> = {
  [TripStatus.PLANNING]:    { display: 'Draft',       bg: '#EEF0F4', fg: '#5B6172', gradient: 'linear-gradient(135deg,#334155,#7889A6)' },
  [TripStatus.INQUIRY]:     { display: 'Inquiry',     bg: '#FFF3E0', fg: '#B7791F', gradient: 'linear-gradient(135deg,#E08A2B,#F5C06B)' },
  [TripStatus.BOOKED]:      { display: 'Booked',      bg: '#16143A', fg: '#FFFFFF', gradient: 'linear-gradient(135deg,#15803D,#5DBE7E)' },
  [TripStatus.IN_PROGRESS]: { display: 'In Progress', bg: '#E3F7EF', fg: '#0E9F6E', gradient: 'linear-gradient(135deg,#0E7C8F,#36C5C0)' },
  [TripStatus.COMPLETED]:   { display: 'Completed',   bg: '#EAF0FF', fg: '#2B63F6', gradient: 'linear-gradient(135deg,#1B5BBE,#5AA0FF)' },
  [TripStatus.CANCELLED]:   { display: 'Cancelled',   bg: '#FDECEC', fg: '#D64545', gradient: 'linear-gradient(135deg,#C2410C,#F59E5B)' },
};

// Maps a mock TripStatus display label to a [background, foreground] color pair for badges.
// Falls back to the 'Draft' colors for any status not in the table.
export function statusMeta(k: string): [string, string] {
  const m: Record<string, [string, string]> = {
    'Draft': ['#EEF0F4','#5B6172'],
    'AI drafting': ['#EAF0FF','#2B63F6'],
    'Awaiting review': ['#FFF3E0','#B7791F'],
    'Shared': ['#F0EBFF','#6B46C1'],
    'Changes requested': ['#FDECEC','#D64545'],
    'Confirmed': ['#E3F7EF','#0E9F6E'],
    'Booked': ['#16143A','#FFFFFF'],
    'Completed': ['#EEF0F4','#8A90A2'],
  };
  return m[k] || m['Draft'];
}

// Hand-written day-by-day itinerary for the "Asante–Mensah Honeymoon" demo trip
// (trip index 0 in tripsData() / tripDetailData() below).
// export function asanteDays(): Day[] {
//   return [
//     {dow:'SAT',day:'04',mon:'Oct',title:'Accra → Santorini',blocks:[
//       {kind:'Flight',kindColor:'#2B63F6',icon:'✈️',iconBg:'#EAF0FF',meta:'07:40 · 11h 20m',title:'Turkish Airlines ACC→JTR',sub:'via Istanbul · 1 stop',price:'GHS 14,200'},
//       {kind:'Transfer',kindColor:'#0E9F6E',icon:'🚐',iconBg:'#E3F7EF',meta:'25 min',title:'Private transfer to Oia',sub:'Meet & greet at arrivals',price:'GHS 480'},
//       {kind:'Stay',kindColor:'#6B46C1',icon:'🏨',iconBg:'#F0EBFF',meta:'Check-in 15:00',title:'Canaves Oia Suites',sub:'3 nights · private plunge pool, sea view',price:'GHS 19,200'},
//       {kind:'Dining',kindColor:'#B7791F',icon:'🍽️',iconBg:'#FFF3E0',meta:'19:30',title:'Welcome dinner at Lauda',sub:'Caldera-view table reserved',price:'GHS 920'},
//     ],hasSuggestion:false},
//     {dow:'SUN',day:'05',mon:'Oct',title:'Santorini',blocks:[
//       {kind:'Activity',kindColor:'#0E9F6E',icon:'⛵',iconBg:'#E3F7EF',meta:'13:00 · 5h',title:'Private caldera catamaran cruise',sub:'Hot springs, Red Beach, sunset, BBQ aboard',price:'GHS 5,400'},
//     ],hasSuggestion:true,suggestion:'A couples sunset spa at the hotel — fits the honeymoon profile and the free morning.'},
//     {dow:'MON',day:'06',mon:'Oct',title:'Santorini',blocks:[
//       {kind:'Activity',kindColor:'#0E9F6E',icon:'👨‍🍳',iconBg:'#E3F7EF',meta:'11:00 · 3h',title:'Greek cooking class in Megalochori',sub:'Hands-on, with local wine pairing',price:'GHS 1,300'},
//     ],hasSuggestion:false},
//     {dow:'WED',day:'08',mon:'Oct',title:'Santorini → Amalfi Coast',blocks:[
//       {kind:'Flight',kindColor:'#2B63F6',icon:'✈️',iconBg:'#EAF0FF',meta:'09:15 · 6h',title:'JTR→NAP',sub:'via Athens · 1 stop',price:'GHS 6,100'},
//       {kind:'Stay',kindColor:'#6B46C1',icon:'🏨',iconBg:'#F0EBFF',meta:'Check-in 14:00',title:'Le Sirenuse — Positano, Sea View',sub:'4 nights · iconic terrace, Michelin dining',price:'GHS 22,000'},
//     ],hasSuggestion:false},
//     {dow:'SUN',day:'12',mon:'Oct',title:'Amalfi Coast',blocks:[
//       {kind:'Activity',kindColor:'#0E9F6E',icon:'🛵',iconBg:'#E3F7EF',meta:'10:00 · full day',title:'Private boat day to Capri',sub:'Blue Grotto, lunch in Marina Piccola',price:'GHS 4,400'},
//     ],hasSuggestion:false},
//   ];
// }

// [color, icon] per messaging channel — used by convoData() to decorate each conversation row.
export const chMeta: Record<string, [string, string]> = {
  whatsapp: ['#25D366','💬'],
  gmail: ['#EA4335','✉️'],
  instagram: ['#C13584','📸'],
};

// Named gradient swatches reused as trip cover backgrounds throughout tripDetailData() below.
export const gradients = {
  blue: 'linear-gradient(135deg,#1B5BBE,#5AA0FF)',
  teal: 'linear-gradient(135deg,#0E7C8F,#36C5C0)',
  orange: 'linear-gradient(135deg,#C2410C,#F59E5B)',
  purple: 'linear-gradient(135deg,#7C3AED,#B58CF5)',
  slate: 'linear-gradient(135deg,#334155,#7889A6)',
  gold: 'linear-gradient(135deg,#E08A2B,#F5C06B)',
  green: 'linear-gradient(135deg,#15803D,#5DBE7E)',
};


// Mock conversation/inbox data for the Messages page — one demo thread per channel/traveler.
export function convoData(): Conversation[] {
  const raw = [
    {name:'Efua Danso',ch:'whatsapp' as const,av:'ED',avBg:'#0E7C8F',last:'Do you plan honeymoons to the Maldives?',time:'4m',unread:1,trip:null as string | null,linkName:null as string | null,
     summary:'New enquiry · honeymoon to the Maldives, likely December. No budget shared yet. Meridian suggests turning this chat into a trip to start drafting options.',
     msgs:[{me:false,t:'Hi! A friend booked through you and loved it 🙏',time:'11:38'},{me:false,t:'We\'re thinking about our honeymoon for December.',time:'11:39'},{me:false,t:'Do you plan honeymoons to the Maldives?',time:'11:40'}]},
    {name:'Ama Asante',ch:'whatsapp' as const,av:'AA',avBg:'#6B46C1',last:'Can\'t wait to see the options! 😍',time:'1h',unread:2,trip:'Asante–Mensah Honeymoon',linkName:'Asante–Mensah Honeymoon',
     summary:'Privacy, sea views & fine dining. Budget ≈ GHS 85k. Kofi is pescatarian. Max 1 stop on flights.',
     msgs:[{me:false,t:'Hi! Following up on our honeymoon — any update?',time:'09:02'},{me:true,t:'Hi Ama! Yes — Meridian has drafted 3 options. Sending them over today 🙌',time:'09:14'},{me:false,t:'Amazing. We\'re leaning Greece + Italy but open to the Maldives idea.',time:'09:16'},{me:false,t:'Can\'t wait to see the options! 😍',time:'09:17'}]},
    {name:'The Adjei Family',ch:'gmail' as const,av:'TA',avBg:'#2B63F6',last:'Re: Dubai July — do we need visas?',time:'3h',unread:0,trip:'Adjei Family Dubai',linkName:'Adjei Family Dubai',
     summary:'Family of four to Dubai, mid-July. Kid-friendly with a desert safari and a couple of standout dinners. Budget ≈ GHS 41k.',
     msgs:[{me:false,t:'Quick one — do Ghanaian passport holders need a visa for the UAE?',time:'Yesterday'},{me:true,t:'Good question! Visa on arrival is available — I\'ll add the details to your trip pack.',time:'Yesterday'}]},
    {name:'Owusu Group',ch:'whatsapp' as const,av:'OG',avBg:'#0E9F6E',last:'Deposit sent via Paystack ✅',time:'5h',unread:0,trip:'Owusu Corporate Retreat',linkName:'Owusu Corporate Retreat',
     summary:'Corporate retreat for 12 in Cape Town, early Aug. Needs meeting space and team dinners. Budget ≈ GHS 128k.',
     msgs:[{me:true,t:'Here\'s the secure payment link for the 50% deposit.',time:'08:20'},{me:false,t:'Deposit sent via Paystack ✅',time:'08:41'}]},
    {name:'Yaa Boateng',ch:'instagram' as const,av:'YB',avBg:'#D64545',last:'Loved option B but can we change…',time:'1d',unread:1,trip:'Boateng Anniversary',linkName:'Boateng Anniversary',
     summary:'Anniversary in Zanzibar. Asked to swap the resort for somewhere quieter, away from the main strip.',
     msgs:[{me:false,t:'Loved option B but can we change the resort to something quieter?',time:'Mon'}]},
  ];
  return raw.map((c,i)=> {
    const cm = chMeta[c.ch];
    return {
      ...c,
      chColor: cm[0],
      chIcon: cm[1],
      onClick: () => {},
      rowBg: i === 0 ? '#F4F7FF' : 'transparent',
      unreadDisplay: c.unread > 0 ? 'flex' as const : 'none' as const,
      hasTrip: !!c.linkName,
      noTrip: !c.linkName,
      linkLabel: c.linkName ? `linked to ${c.linkName}` : 'not linked to a trip yet',
      tripGradient: 'linear-gradient(135deg,#1B5BBE,#5AA0FF)',
      tripStatus: '',
      tripStatusBg: '#EEF0F4',
      tripStatusFg: '#5B6172',
      tripValue: '',
      openLinkedTrip: () => {},
      msgs: c.msgs.map(m => ({
        t: m.t, time: m.time, me: m.me,
        align: m.me ? 'flex-end' as const : 'flex-start' as const,
        textAlign: m.me ? 'right' as const : 'left' as const,
        bubbleBg: m.me ? '#2B63F6' : '#fff',
        bubbleFg: m.me ? '#fff' : '#15161B',
        bubbleBorder: m.me ? 'none' : '1px solid #ECEDF2',
      })),
    };
  });
}

// The 7 demo trips shown on the Trips list / Dashboard "trips in motion" panel when no real
// API trip data is available. Each tuple in `raw` is positional — see the destructure below
// for what each index means (name, traveler, initials, avatar color, destination, dates,
// status, budget, itinerary-option count, cover gradient, "next step" label).
// export function tripsData(): TripItem[] {
//   const raw: [string,string,string,string,string,string,TripStatus,string,number,string,string][] = [
//     ['Asante–Mensah Honeymoon','Ama & Kofi Asante','AA','#6B46C1','Santorini · Amalfi','4–14 Oct','Awaiting review','GHS 84,500',3,'linear-gradient(135deg,#1B5BBE,#5AA0FF)','Send options to traveler'],
//     ['Adjei Family Dubai','The Adjei Family','TA','#2B63F6','Dubai','12–19 Jul','AI drafting','GHS 41,200',1,'linear-gradient(135deg,#E08A2B,#F5C06B)','Meridian is drafting itinerary'],
//     ['Owusu Corporate Retreat','Owusu Group','OG','#0E9F6E','Cape Town','2–6 Aug','Shared','GHS 128,000',2,'linear-gradient(135deg,#0E7C8F,#36C5C0)','Waiting on traveler decision'],
//     ['Boateng Anniversary','Yaa Boateng','YB','#D64545','Zanzibar','9–15 Sep','Changes requested','GHS 38,900',2,'linear-gradient(135deg,#C2410C,#F59E5B)','Traveler asked for changes'],
//     ['Mensah Solo Tokyo','Kojo Mensah','KM','#16143A','Tokyo','1–9 Nov','Confirmed','GHS 52,300',1,'linear-gradient(135deg,#7C3AED,#B58CF5)','Awaiting deposit'],
//     ['Tetteh Group Lagos','Tetteh & co','TC','#B7791F','Lagos','28–30 Jun','Booked','GHS 22,400',1,'linear-gradient(135deg,#15803D,#5DBE7E)','All booked · departs 28 Jun'],
//     ['Sarpong Europe Tour','Nana Sarpong','NS','#2B63F6','Paris · Rome · Barcelona','18–30 Dec','Draft','GHS 96,700',1,'linear-gradient(135deg,#334155,#7889A6)','Discovery call summarised'],
//   ];
//   return raw.map((r) => {
//     const sm = statusMeta(r[6]);
//     return {
//       name: r[0], traveler: r[1], initials: r[2], avatarBg: r[3], where: r[4], dates: r[5],
//       status: r[6], statusBg: sm[0], statusFg: sm[1], value: r[7],
//       optsLabel: r[8] + (r[8] > 1 ? ' opts' : ' opt'), cover: r[9], next: r[10],
//       open: () => {},
//     };
//   });
// }

// Builds the full mock TripDetailData for one of the 7 demo trips (by its index in
// tripsData()), for the given active itinerary-option letter. This is what AppContext's
// getTripDetail()/TripDetail.tsx fall back to when there's no real apiTrip loaded.
// `D` below holds the per-trip extras (gradient, brief, days, costs, options, ...) that
// aren't already covered by tripsData(); `headerActions` are then derived from the trip's
// status to decide which action buttons the hero banner shows.
// `_activeOption` isn't used inside — mock trips only ever show their D[i] entry regardless
// of which option letter is active — but every caller passes it, matching the signature real
// itinerary-backed trips need (see apiTripToTripDetail() in AppContext.tsx, which does use its
// `opt` argument to pick a specific itinerary option).
// export function tripDetailData(index: number, _activeOption: string): TripDetailData {
//   const i = index;
//   const days = asanteDays();

//   const D: Record<number, {
//     gradient: string;
//     origin: string;
//     brief?: string;
//     briefChips?: string[];
//     options: TripOption[];
//     days: Day[];
//     costs: CostItem[];
//     sentInfo?: string;
//     requestNote?: string;
//     depositInfo?: string;
//     depart?: string;
//     bookingRefs?: { label: string; value: string }[];
//   }> = {};

//   const g = gradients;

//   D[0] = {
//     gradient: 'linear-gradient(120deg,#1B5BBE,#2B63F6 55%,#5AA0FF)',
//     origin: '💬 Originated from a WhatsApp enquiry · 12 Jun',
//     options: [
//       {letter:'A',name:'Santorini + Amalfi',sub:'Greece & Italy · 10 nts',cover:g.blue,rec:true,recDisplay:'inline-block',border:'#2B63F6',bg:'#F4F7FF',titleColor:'#2B63F6',onClick:()=>{}},
//       {letter:'B',name:'Maldives',sub:'Overwater · 9 nts',cover:g.teal,rec:false,recDisplay:'none',border:'#ECEDF2',bg:'#fff',titleColor:'#15161B',onClick:()=>{}},
//       {letter:'C',name:'Zanzibar & Safari',sub:'Tanzania · 11 nts',cover:g.orange,rec:false,recDisplay:'none',border:'#ECEDF2',bg:'#fff',titleColor:'#15161B',onClick:()=>{}},
//     ],
//     days,
//     costs: [
//       {label:'Flights',value:'GHS 28,400'},
//       {label:'Stays',value:'GHS 41,200'},
//       {label:'Activities',value:'GHS 9,800'},
//       {label:'Transfers',value:'GHS 2,300'},
//       {label:'Meridian service fee',value:'GHS 2,800'},
//     ],
//   };
//   D[1] = {
//     gradient: g.gold,
//     origin: '✉️ Originated from a Gmail enquiry · 9 Jun',
//     brief: 'Family of four to Dubai in mid-July — kid-friendly, a desert safari and a couple of standout dinners. Budget ≈ GHS 41k.',
//     briefChips: ['👪 2 adults · 2 children','📅 12 – 19 Jul 2026','💰 Budget ≈ GHS 41,200','🏜️ Wants a desert safari'],
//     options: [
//       {letter:'A',name:'Dubai family week',sub:'UAE · 7 nts',cover:g.gold,rec:true,recDisplay:'inline-block',border:'#2B63F6',bg:'#F4F7FF',titleColor:'#2B63F6',onClick:()=>{}},
//     ],
//     days: [],
//     costs: [],
//   };
//   D[2] = {
//     gradient: g.teal,
//     origin: '💬 Originated from a WhatsApp enquiry · 28 May',
//     options: [
//       {letter:'A',name:'Cape Town retreat',sub:'South Africa · 4 nts',cover:g.teal,rec:true,recDisplay:'inline-block',border:'#2B63F6',bg:'#F4F7FF',titleColor:'#2B63F6',onClick:()=>{}},
//     ],
//     sentInfo: 'Sent to Owusu Group 2 days ago via WhatsApp',
//     days: [
//       {dow:'FRI',day:'02',mon:'Aug',title:'Accra → Cape Town',blocks:[
//         B('Flight','Accra (ACC) → Cape Town (CPT)','RwandAir · via Kigali · 1 stop','06:30 · 12h 10m','GHS 18,400'),
//         B('Transfer','Group coach to V&A Waterfront','Meet & greet for 12','25 min','GHS 1,200'),
//         B('Stay','One&Only Cape Town — 6 rooms','4 nights · marina view, breakfast','Check-in 14:00','GHS 52,000'),
//         B('Dining','Welcome dinner at The Test Kitchen','Private room reserved','19:30','GHS 3,200'),
//       ],hasSuggestion:false},
//       {dow:'SAT',day:'03',mon:'Aug',title:'Cape Town · team day',blocks:[
//         B('Venue','Private boardroom & breakout space','Half-day with AV + catering','09:00 · 4h','GHS 12,000'),
//         B('Activity','Table Mountain cableway & guided walk','Group of 12','14:00 · 3h','GHS 1,400'),
//         B('Dining','Stellenbosch wine-estate dinner','Coach there & back included','19:00','GHS 4,800'),
//       ],hasSuggestion:false},
//     ],
//     costs: [
//       {label:'Flights',value:'GHS 36,800'},
//       {label:'Stays',value:'GHS 52,000'},
//       {label:'Venue & AV',value:'GHS 12,000'},
//       {label:'Activities & dining',value:'GHS 18,400'},
//       {label:'Meridian service fee',value:'GHS 8,800'},
//     ],
//   };
//   D[3] = {
//     gradient: g.orange,
//     origin: '📸 Originated from an Instagram DM · 1 Jun',
//     options: [
//       {letter:'A',name:'Beachfront escape',sub:'Zanzibar · 6 nts',cover:g.orange,rec:false,recDisplay:'none',border:'#ECEDF2',bg:'#fff',titleColor:'#15161B',onClick:()=>{}},
//       {letter:'B',name:'Quiet north coast',sub:'Zanzibar · 6 nts',cover:g.teal,rec:true,recDisplay:'inline-block',border:'#2B63F6',bg:'#F4F7FF',titleColor:'#2B63F6',onClick:()=>{}},
//     ],
//     requestNote: '"Loved option B but can we move the resort somewhere quieter, away from the main strip?"',
//     days: [
//       {dow:'TUE',day:'09',mon:'Sep',title:'Accra → Zanzibar',blocks:[
//         B('Flight','Accra (ACC) → Zanzibar (ZNZ)','Ethiopian · via Addis · 1 stop','08:10 · 11h 40m','GHS 9,800'),
//         B('Stay','Riu Palace Zanzibar — Nungwi','3 nights · busy main strip — flagged to change','Check-in 15:00','GHS 14,200'),
//         B('Dining','Beachfront BBQ dinner','By the pool','19:30','GHS 900'),
//       ],hasSuggestion:false},
//       {dow:'WED',day:'10',mon:'Sep',title:'Zanzibar',blocks:[
//         B('Activity','Spice farm guided tour','Tastings included','10:00 · 3h','GHS 700'),
//         B('Activity','Sunset dhow cruise','Private boat for two','17:00 · 2h','GHS 1,100'),
//       ],hasSuggestion:false},
//     ],
//     costs: [
//       {label:'Flights',value:'GHS 19,600'},
//       {label:'Stays',value:'GHS 14,200'},
//       {label:'Activities',value:'GHS 1,800'},
//       {label:'Transfers',value:'GHS 900'},
//       {label:'Meridian service fee',value:'GHS 2,400'},
//     ],
//   };
//   D[4] = {
//     gradient: g.purple,
//     origin: '💬 Originated from a WhatsApp enquiry · 20 May',
//     options: [
//       {letter:'A',name:'Tokyo solo explorer',sub:'Japan · 8 nts',cover:g.purple,rec:true,recDisplay:'inline-block',border:'#2B63F6',bg:'#F4F7FF',titleColor:'#2B63F6',onClick:()=>{}},
//     ],
//     depositInfo: 'GHS 26,150 · 50%',
//     days: [
//       {dow:'SAT',day:'01',mon:'Nov',title:'Accra → Tokyo',blocks:[
//         B('Flight','Accra (ACC) → Tokyo (HND)','Turkish · via Istanbul · 1 stop','22:00 · 21h 30m','GHS 19,600'),
//         B('Transfer','Airport express to Shiodome','IC card loaded','40 min','GHS 700'),
//         B('Stay','Park Hotel Tokyo — Artist Room','7 nights · skyline view','Check-in 15:00','GHS 21,000'),
//       ],hasSuggestion:false},
//       {dow:'SUN',day:'02',mon:'Nov',title:'Tokyo',blocks:[
//         B('Activity','teamLab Planets','Timed entry booked','10:00 · 2h','GHS 480'),
//         B('Dining','Tsukiji outer-market sushi','Chef\'s counter','12:30','GHS 900'),
//         B('Activity','Shibuya & Shimokitazawa walk','Self-guided route','15:00','GHS 600'),
//       ],hasSuggestion:false},
//     ],
//     costs: [
//       {label:'Flights',value:'GHS 19,600'},
//       {label:'Stays',value:'GHS 21,000'},
//       {label:'Activities',value:'GHS 7,300'},
//       {label:'Transfers',value:'GHS 1,600'},
//       {label:'Meridian service fee',value:'GHS 2,800'},
//     ],
//   };
//   D[5] = {
//     gradient: g.green,
//     origin: '✉️ Originated from a Gmail enquiry · 30 May',
//     options: [
//       {letter:'A',name:'Lagos group weekend',sub:'Nigeria · 2 nts',cover:g.green,rec:true,recDisplay:'inline-block',border:'#2B63F6',bg:'#F4F7FF',titleColor:'#2B63F6',onClick:()=>{}},
//     ],
//     depart: '28 Jun',
//     bookingRefs: [{label:'Flight PNR',value:'TT-9F2K'},{label:'Hotel conf.',value:'EK-44871'}],
//     days: [
//       {dow:'SAT',day:'28',mon:'Jun',title:'Accra → Lagos',blocks:[
//         B('Flight','Accra (ACC) → Lagos (LOS)','Africa World Airlines · direct','09:20 · 1h 05m','GHS 4,200'),
//         B('Transfer','Airport pickup for 6','Two vehicles','30 min','GHS 600'),
//         B('Stay','Eko Hotel & Suites — 3 rooms','2 nights · lagoon view','Check-in 14:00','GHS 14,800'),
//         B('Dining','Group dinner at Nok by Alara','Table for 6 reserved','20:00','GHS 2,000'),
//       ],hasSuggestion:false},
//     ],
//     costs: [
//       {label:'Flights',value:'GHS 4,200'},
//       {label:'Stays',value:'GHS 14,800'},
//       {label:'Dining',value:'GHS 2,000'},
//       {label:'Transfers',value:'GHS 600'},
//       {label:'Meridian service fee',value:'GHS 800'},
//     ],
//   };
//   D[6] = {
//     gradient: g.slate,
//     origin: '🎙️ Discovery call summarised · 14 Jun',
//     brief: 'Multi-city festive tour of Paris, Rome and Barcelona over 12 nights. A mix of culture, great food and a little luxury, travelling city-to-city by rail and short flights. Budget ≈ GHS 95k.',
//     briefChips: ['🧑 1 traveler','📅 18 – 30 Dec 2026','💰 Budget ≈ GHS 96,700','🚆 Prefers rail between cities'],
//     options: [],
//     days: [],
//     costs: [],
//   };

//   const trips = tripsData();
//   const t = trips[i] || trips[0];
//   const d = D[i] || D[0];
//   const statusKey = t.status;
//   const sm = statusMeta(t.status);

//   const headerActions: HeaderAction[] = [];
//   if (statusKey === 'Draft') {
//     headerActions.push({label:'✦ Generate options',onClick:()=>{},bg:'#2B63F6',fg:'#fff',border:'#2B63F6'});
//     headerActions.push({label:'Message Ama',onClick:()=>{},bg:'#fff',fg:'#5B6172',border:'#DDE0E8'});
//   } else if (statusKey === 'Awaiting review') {
//     headerActions.push({label:'Preview',onClick:()=>{},bg:'#fff',fg:'#5B6172',border:'#DDE0E8'});
//     headerActions.push({label:'Share with Ama',onClick:()=>{},bg:'#2B63F6',fg:'#fff',border:'#2B63F6'});
//   } else if (statusKey === 'Shared') {
//     headerActions.push({label:'Resend link',onClick:()=>{},bg:'#fff',fg:'#5B6172',border:'#DDE0E8'});
//     headerActions.push({label:'Nudge Ama',onClick:()=>{},bg:'#2B63F6',fg:'#fff',border:'#2B63F6'});
//   } else if (statusKey === 'Changes requested') {
//     headerActions.push({label:'Make changes',onClick:()=>{},bg:'#2B63F6',fg:'#fff',border:'#2B63F6'});
//     headerActions.push({label:'Message Yaa',onClick:()=>{},bg:'#fff',fg:'#5B6172',border:'#DDE0E8'});
//   } else if (statusKey === 'Confirmed') {
//     headerActions.push({label:'Send deposit link',onClick:()=>{},bg:'#13B981',fg:'#fff',border:'#13B981'});
//     headerActions.push({label:'Message Kojo',onClick:()=>{},bg:'#fff',fg:'#5B6172',border:'#DDE0E8'});
//   } else if (statusKey === 'Booked') {
//     headerActions.push({label:'View trip pack',onClick:()=>{},bg:'#fff',fg:'#5B6172',border:'#DDE0E8'});
//     headerActions.push({label:'Message Tetteh',onClick:()=>{},bg:'#2B63F6',fg:'#fff',border:'#2B63F6'});
//   } else {
//     headerActions.push({label:'Preview',onClick:()=>{},bg:'#fff',fg:'#5B6172',border:'#DDE0E8'});
//     headerActions.push({label:'Share',onClick:()=>{},bg:'#2B63F6',fg:'#fff',border:'#2B63F6'});
//   }

//   return {
//     name: t.name, traveler: t.traveler, dates: t.dates + ' 2026', where: t.where, value: t.value,
//     status: statusKey, statusBg: sm[0], statusFg: sm[1],
//     gradient: d.gradient, origin: d.origin,
//     total: t.value,
//     days: d.days,
//     costs: d.costs,
//     options: d.options,
//     optionsLabel: d.options && d.options.length > 1
//       ? d.options.length + ' itinerary options for this request:'
//       : 'Itinerary option:',
//     brief: d.brief,
//     briefChips: d.briefChips,
//     sentInfo: d.sentInfo,
//     requestNote: d.requestNote,
//     depositInfo: d.depositInfo,
//     depart: d.depart,
//     bookingRefs: d.bookingRefs,
//     headerActions,
//   };
// }

// Mock "Meridian activity" feed shown on the Dashboard and TripDetail sidebar.
export function agentFeed(): AgentFeedItem[] {
  return [
    {iconEl:'📝',iconBg:'#EAF0FF',title:'Drafted 3 itinerary options',detail:'Asante–Mensah Honeymoon · Santorini, Maldives & Zanzibar',time:'6m ago',actionLabel:'Review options',action:()=>{}},
    {iconEl:'✈️',iconBg:'#FFF3E0',title:'Flight EK788 rescheduled',detail:'Adjei Family Dubai · Meridian found 2 alternatives',time:'22m ago',actionLabel:'View alternatives',action:()=>{}},
    {iconEl:'💳',iconBg:'#E3F7EF',title:'Payment received · GHS 4,200',detail:'Owusu deposit via Paystack',time:'1h ago',actionLabel:'View invoice',action:()=>{}},
    {iconEl:'💬',iconBg:'#E3F7EF',title:'New WhatsApp message',detail:'Ama Asante — "Can\'t wait to see the options!"',time:'1h ago',actionLabel:'Open chat',action:()=>{}},
    {iconEl:'🎙️',iconBg:'#F0EBFF',title:'Call summary ready',detail:'Sarpong discovery call · 6 action points captured',time:'2h ago',actionLabel:'View summary',action:()=>{}},
  ];
}

// Mock flight options for the "Flights" builder tab (mock/non-API trips only — real trips
// show their actual ItineraryFlight rows instead, converted by itineraryFlightsToFlights()).
// export function flightsData(): Flight[] {
//   return [
//     {code:'TK',airline:'Turkish Airlines',route:'ACC 07:40 → JTR 21:00 · via IST',duration:'13h 05m',stops:'1 stop',price:'GHS 14,200',cta:'Selected',logoBg:'#C2102E',recDisplay:'inline-block',border:'#2B63F6',bg:'#F4F7FF'},
//     {code:'MS',airline:'EgyptAir',route:'ACC 23:10 → JTR 14:50 · via CAI',duration:'15h 40m',stops:'1 stop',price:'GHS 12,900',cta:'Select',logoBg:'#16143A',recDisplay:'none',border:'#ECEDF2',bg:'#fff'},
//     {code:'LH',airline:'Lufthansa',route:'ACC 06:00 → JTR 18:10 · via FRA',duration:'14h 10m',stops:'1 stop',price:'GHS 16,050',cta:'Select',logoBg:'#05164D',recDisplay:'none',border:'#ECEDF2',bg:'#fff'},
//   ];
// }

// Mock accommodation options for the "Stays" builder tab (mock/non-API trips only).
// export function staysData(): Stay[] {
//   return [
//     {name:'Canaves Oia Suites',loc:'Oia, Santorini',rating:'4.9',price:'GHS 6,400',cover:'linear-gradient(135deg,#1B5BBE,#5AA0FF)',recDisplay:'block',border:'#2B63F6',bg:'#F4F7FF',tags:['Private pool','Sea view','Breakfast']},
//     {name:'Mystique, Luxury Collection',loc:'Oia, Santorini',rating:'4.8',price:'GHS 7,100',cover:'linear-gradient(135deg,#0E7C8F,#36C5C0)',recDisplay:'none',border:'#ECEDF2',bg:'#fff',tags:['Spa','Cave pool','Wine cellar']},
//     {name:'Grace Hotel Auberge',loc:'Imerovigli',rating:'4.7',price:'GHS 5,200',cover:'linear-gradient(135deg,#7C3AED,#B58CF5)',recDisplay:'none',border:'#ECEDF2',bg:'#fff',tags:['Infinity pool','Champagne lounge']},
//   ];
// }

// Mock add-on activities for the "Activities" builder tab (mock/non-API trips only).
// Each `add()` callback appends the activity to the last day via AppContext.addActivity().
// export function activitiesData(): Activity[] {
//   const raw = [
//     {name:'Couples sunset spa',meta:'Santorini · 2h',price:'GHS 1,800',cover:'linear-gradient(135deg,#7C3AED,#B58CF5)'},
//     {name:'Santo Wines tasting',meta:'Santorini · 2h',price:'GHS 760',cover:'linear-gradient(135deg,#C2410C,#F59E5B)'},
//     {name:'Helicopter to Amalfi',meta:'Naples → Positano',price:'GHS 9,200',cover:'linear-gradient(135deg,#1B5BBE,#5AA0FF)'},
//     {name:'Private chef dinner',meta:'In-villa · Positano',price:'GHS 3,100',cover:'linear-gradient(135deg,#0E7C8F,#36C5C0)'},
//     {name:'Pompeii guided tour',meta:'Naples · half day',price:'GHS 1,450',cover:'linear-gradient(135deg,#334155,#7889A6)'},
//     {name:'Limoncello & ceramics',meta:'Amalfi · 3h',price:'GHS 640',cover:'linear-gradient(135deg,#B7791F,#F5C06B)'},
//   ];
//   return raw.map(a => ({...a, add: () => {}}));
// }

// Mock call history + AI-generated call summaries for the "Calls" builder tab.
export function callLogs(): { logs: CallLog[], details: CallDetail[] } {
  const logs: CallLog[] = [
    {title:'Discovery call — Asante',meta:'12 Jun · 28 min · Google Meet',icon:'🎥',onClick:()=>{},bg:'#F4F7FF',border:'#C4D2FF'},
    {title:'Follow-up — budget & dates',meta:'16 Jun · 14 min · Google Meet',icon:'🎥',onClick:()=>{},bg:'transparent',border:'transparent'},
  ];
  const details: CallDetail[] = [
    {title:'Discovery call — Ama & Kofi Asante',meta:'12 Jun · 28 min',
     summary:'Newlywed couple planning a 10-day honeymoon for early October. Budget is flexible around GHS 80–90k. Strong preference for privacy, sea views, fine dining, and a balance of relaxation with one or two standout experiences. Open to Europe but not interested in long, multi-stop travel days.',
     actions:[{n:'1',text:'Send 3 itinerary options by 15 Jun'},{n:'2',text:'Prioritise sea-view suites with private terraces'},{n:'3',text:'Include at least one boat or cruise experience'},{n:'4',text:'Confirm dietary needs — Kofi is pescatarian'},{n:'5',text:'Quote travel insurance separately'}],
     decisions:['Region: Mediterranean','Max 1 stop on flights','10 nights','Budget ≈ GHS 85k']},
    {title:'Follow-up — budget & dates',meta:'16 Jun · 14 min',
     summary:'Couple confirmed the 4–14 October window and a firm ceiling of GHS 90k all-in. They liked the Santorini + Amalfi concept most and asked to see a Maldives alternative. Kofi raised a preference for a private boat day over group tours.',
     actions:[{n:'1',text:'Lock 4–14 Oct dates with airlines'},{n:'2',text:'Add a Maldives option (Option B)'},{n:'3',text:'Swap group catamaran for private charter'},{n:'4',text:'Resend updated quote within budget'}],
     decisions:['Dates locked: 4–14 Oct','Ceiling GHS 90k','Private experiences preferred']},
  ];
  return { logs, details };
}

// Mock top-line revenue/outstanding/paid-out/refund stat cards. Exposed via AppContext's
// getFinancialData()/getDashboardStats(), but Financials.tsx and Dashboard.tsx were both
// rewired to compute their stats from real API data instead — neither page calls this
// anymore, so it's effectively orphaned (kept in case something still references it).
// export function finStats(): FinStat[] {
//   return [
//     {label:'Revenue · June',value:'GHS 64,300',delta:'↑ 18% vs May',deltaColor:'#0E9F6E'},
//     {label:'Outstanding',value:'GHS 22,800',delta:'3 invoices',deltaColor:'#B7791F'},
//     {label:'Paid out',value:'GHS 41,500',delta:'Next payout 24 Jun',deltaColor:'#8A90A2'},
//     {label:'Refunds',value:'GHS 1,200',delta:'1 this month',deltaColor:'#8A90A2'},
//   ];
// }

// Mock monthly revenue bar-chart data. Only reachable via AppContext.getFinancialData(),
// which Financials.tsx no longer calls (it renders its own chart from real transactions) —
// effectively orphaned.
// export function chartData(): ChartBar[] {
//   const raw: [string,number][] = [['Jan',38],['Feb',42],['Mar',51],['Apr',47],['May',58],['Jun',64]];
//   return raw.map((m,i) => ({
//     label: m[0],
//     h: (m[1] / 64 * 150) + 'px',
//     value: 'GHS ' + m[1] + 'k',
//     barBg: i === 5 ? '#2B63F6' : '#DCE6FF',
//     barLabelColor: i === 5 ? '#2B63F6' : '#AEB3C2',
//   }));
// }

function fmt(n: number): string {
  return 'GHS ' + n.toLocaleString('en-US');
}

const invMeta: Record<string, [string,string]> = {
  'Paid': ['#E3F7EF','#0E9F6E'],
  'Partial': ['#EAF0FF','#2B63F6'],
  'Pending': ['#FFF3E0','#B7791F'],
  'Overdue': ['#FDECEC','#D64545'],
  'Refunded': ['#EEF0F4','#8A90A2'],
};

const invDefs: {
  id: string; client: string; initials: string; avatarBg: string; trip: string; tripIdx: number;
  agent: string; email: string; phone: string; issued: string; due: string; method: string;
  status: string; total: number;
  items: [string,number][];
  payments: [string,string,number,string,string][];
  schedule: [string,number,string][];
}[] = [
  {id:'INV-1042', client:'Owusu Group', initials:'OG', avatarBg:'#2B63F6', trip:'Cape Town Retreat', tripIdx:2, agent:'Kweku Ansah', email:'accounts@owusugroup.com', phone:'+233 24 555 0192', issued:'2 Jun 2026', due:'18 Jun 2026', method:'Paystack', status:'Paid', total:64000,
   items:[['Flights · 8 pax · Accra ⇄ Cape Town',28800],['Stays · 9 nights · One&Only',27000],['Experiences · 5 included',6000],['Meridian service fee',2200]],
   payments:[['2 Jun 2026','Deposit · 50%',32000,'Paystack','PSK-8841'],['18 Jun 2026','Balance · 50%',32000,'Paystack','PSK-9023']], schedule:[]},
  {id:'INV-1041', client:'The Adjei Family', initials:'AF', avatarBg:'#7C5CFC', trip:'Dubai · Family', tripIdx:1, agent:'Adwoa Mensah', email:'kojo.adjei@gmail.com', phone:'+233 20 411 7788', issued:'8 Jun 2026', due:'30 Jun 2026', method:'Paystack', status:'Partial', total:20600,
   items:[['Flights · 4 pax · Accra ⇄ Dubai',9200],['Stays · 6 nights · Atlantis The Palm',8600],['Desert & city experiences',1800],['Meridian service fee',1000]],
   payments:[['8 Jun 2026','Deposit · 50%',10300,'Paystack','PSK-8990']], schedule:[['Balance · 50%',10300,'Due 30 Jun 2026']]},
  {id:'INV-1039', client:'Kojo Mensah', initials:'KM', avatarBg:'#0E9F6E', trip:'Tokyo', tripIdx:3, agent:'Yaw Boateng', email:'kojo.m@outlook.com', phone:'+233 27 330 5510', issued:'1 Jun 2026', due:'14 Jun 2026', method:'Paystack', status:'Paid', total:26150,
   items:[['Flights · 2 pax · Accra ⇄ Tokyo',16400],['Stays · 7 nights · Park Hyatt',7600],['Meridian service fee',2150]],
   payments:[['14 Jun 2026','Paid in full',26150,'Paystack','PSK-8770']], schedule:[]},
  {id:'INV-1037', client:'Tetteh & Co', initials:'TC', avatarBg:'#B7791F', trip:'Lagos', tripIdx:4, agent:'Adwoa Mensah', email:'finance@tetteh.co', phone:'+234 80 221 4400', issued:'4 Jun 2026', due:'11 Jun 2026', method:'Bank transfer', status:'Partial', total:22400,
   items:[['Flights · 6 pax · Accra ⇄ Lagos',7800],['Stays · 4 nights · Eko Hotel',9200],['Conference logistics',4400],['Meridian service fee',1000]],
   payments:[['4 Jun 2026','First instalment',8000,'Bank transfer','TRF-2218'],['9 Jun 2026','Second instalment',7000,'Bank transfer','TRF-2240']], schedule:[['Final instalment',7400,'Due 25 Jun 2026']]},
  {id:'INV-1035', client:'Yaa Boateng', initials:'YB', avatarBg:'#C2410C', trip:'Zanzibar', tripIdx:5, agent:'Kweku Ansah', email:'yaa.boat@gmail.com', phone:'+233 24 770 9981', issued:'20 May 2026', due:'2 Jun 2026', method:'Paystack', status:'Overdue', total:19450,
   items:[['Flights · 2 pax · Accra ⇄ Zanzibar',10200],['Stays · 6 nights · Park Hyatt',7250],['Meridian service fee',2000]],
   payments:[], schedule:[['Full balance',19450,'Was due 2 Jun 2026']]},
  {id:'INV-1031', client:'Nana Sarpong', initials:'NS', avatarBg:'#5B6172', trip:'Europe Tour', tripIdx:6, agent:'Yaw Boateng', email:'nana.sarpong@gmail.com', phone:'+233 20 556 1212', issued:'24 May 2026', due:'28 May 2026', method:'Paystack', status:'Refunded', total:1200,
   items:[['Cancellation admin fee',1200]],
   payments:[['25 May 2026','Deposit',1200,'Paystack','PSK-8401'],['28 May 2026','Refund issued',-1200,'Paystack','PSK-8402R']], schedule:[]},
];

// Six mock invoices. `detail()` powers AppContext.getInvoiceDetail() → InvoiceDetailModal.tsx.
// `list` is rendered as the Invoices card on Financials.tsx; each row opens the modal via
// ctx.openInvoiceDetail(id). `tripDetail` maps an invoice back to its trip index.
export function invoicesData(): {
  list: InvoiceItem[];
  detail: (id: string) => InvoiceDetail | null;
  tripDetail: (id: string) => { openTrip: () => void; tripIdx: number } | null;
} {
  const list: InvoiceItem[] = invDefs.map(v => {
    const paid = v.payments.reduce((a,p) => a + (p[2] > 0 ? p[2] : 0), 0);
    const balance = v.total - paid;
    const m = invMeta[v.status];
    let balanceHint = '';
    if (v.status === 'Partial') balanceHint = fmt(balance) + ' left';
    else if (v.status === 'Overdue') balanceHint = 'Unpaid';
    return {
      id: v.id, client: v.client, trip: v.trip, amount: fmt(v.total),
      status: v.status, statusBg: m[0], statusFg: m[1],
      method: v.method, date: v.issued, balanceHint,
      open: () => {},
    };
  });

  const detail = (id: string): InvoiceDetail | null => {
    const oi = invDefs.find(v => v.id === id);
    if (!oi) return null;
    const paid = oi.payments.reduce((a,p) => a + (p[2] > 0 ? p[2] : 0), 0);
    const balance = oi.total - paid;
    const m = invMeta[oi.status];
    const pct = oi.total > 0 ? Math.round(paid / oi.total * 100) : 0;
    return {
      id: oi.id, status: oi.status, statusBg: m[0], statusFg: m[1],
      issued: oi.issued, due: oi.due, method: oi.method, agent: oi.agent, trip: oi.trip,
      client: oi.client, initials: oi.initials, avatarBg: oi.avatarBg, email: oi.email, phone: oi.phone,
      total: fmt(oi.total), paid: fmt(paid), balance: fmt(balance), pct: pct + '%',
      barColor: balance <= 0 ? '#13B981' : (oi.status === 'Overdue' ? '#D64545' : '#2B63F6'),
      summaryLabel: balance <= 0 ? 'Fully paid' : fmt(balance) + ' outstanding',
      summaryColor: balance <= 0 ? '#0E9F6E' : (oi.status === 'Overdue' ? '#D64545' : '#B7791F'),
      hasBalance: balance > 0,
      items: oi.items.map(it => ({label: it[0], amount: fmt(it[1])})),
      payments: oi.payments.map(p => ({
        date: p[0], label: p[1],
        amount: p[2] < 0 ? '– ' + fmt(-p[2]) : fmt(p[2]),
        method: p[3], ref: p[4], dot: p[2] < 0 ? '#D64545' : '#13B981',
      })),
      schedule: oi.schedule.map(s => ({label: s[0], amount: fmt(s[1]), due: s[2]})),
      hasSchedule: oi.schedule.length > 0,
      openTrip: () => {},
    };
  };

  const tripDetail = (id: string): { openTrip: () => void; tripIdx: number } | null => {
    const oi = invDefs.find(v => v.id === id);
    if (!oi) return null;
    return { openTrip: () => {}, tripIdx: oi.tripIdx };
  };

  return { list, detail, tripDetail };
}

// Pricing plan cards for the Pricing page (ctx.getPlans() → Pricing.tsx). `annual` billing
// is priced at 10x the monthly rate (i.e. ~17% off a 12x multiple) as a simple placeholder deal.
export function plansData(billing: BillingPeriod, currentPlan: string, toast: (msg: string) => void): Plan[] {
  const annual = billing === 'annual';
  const raw = [
    {name:'Starter',tag:'For solo agents & small teams',mo:450,cur:currentPlan==='Starter',pop:false,
     features:['1 workspace','Up to 50 trips / month','2 connected channels','AI itinerary drafting','Email support']},
    {name:'Growth',tag:'For growing agencies',mo:1200,cur:currentPlan==='Growth',pop:true,
     features:['Everything in Starter','Unlimited trips','All channels — WhatsApp, Gmail, IG','AI call summaries & action points','Paystack payments','5 team seats','Priority support']},
    {name:'Enterprise',tag:'For large travel operators',mo:null,cur:currentPlan==='Enterprise',pop:false,
     features:['Everything in Growth','Unlimited team seats','SSO & advanced roles','Dedicated agent tuning','SLA & guided onboarding','Custom integrations']},
  ];
  return raw.map(p => {
    const price = p.mo === null ? 'Custom' : ('GHS ' + (annual ? (p.mo * 10).toLocaleString() : p.mo.toLocaleString()));
    const per = p.mo === null ? '' : (annual ? '/year' : '/month');
    return {
      ...p, price, per,
      ctaLabel: p.cur ? 'Current plan' : (p.mo === null ? 'Contact sales' : 'Choose ' + p.name),
      ctaBg: p.cur ? '#EEF0F4' : (p.pop ? '#2B63F6' : '#fff'),
      ctaFg: p.cur ? '#8A90A2' : (p.pop ? '#fff' : '#2B63F6'),
      ctaBorder: p.cur ? '#ECEDF2' : (p.pop ? '#2B63F6' : '#C4D2FF'),
      border: p.pop ? '#2B63F6' : '#ECEDF2',
      popDisplay: p.pop ? 'inline-block' : 'none',
      onClick: p.cur ? () => {} : () => toast(p.mo === null ? 'Our team will reach out shortly' : 'Switched to the ' + p.name + ' plan'),
    };
  });
}

// Reshapes the mock tripsData() into TravelerItem rows (one "traveler" per demo trip).
// Only reachable via AppContext.getTravelersData(), which the real Travelers.tsx page no
// longer calls (it fetches real customers instead) — effectively orphaned.
// export function travelersData(): TravelerItem[] {
//   return tripsData().map((t) => ({
//     name: t.traveler, initials: t.initials, avatarBg: t.avatarBg,
//     trip: t.name, status: t.status, statusBg: t.statusBg, statusFg: t.statusFg,
//     value: t.value, where: t.where, open: () => {},
//   }));
// }

// Mock team roster. Reachable via AppContext.getTeamData(), but Settings.tsx's Team & Seats
// tab now fetches the real company's users from the API instead — effectively orphaned,
// along with rolesData()/channelsData()/notificationsData() below (same getTeamData() bundle).
export function teamMembers(): TeamMember[] {
  const raw = [
    {name:'Kweku Ansah', email:'kweku@oasistravel.com', initials:'KA', avatarBg:'#2B63F6', role:'Super admin', roleBg:'#EAF0FF', roleFg:'#2B63F6', active:'Active now', you:true},
    {name:'Adwoa Mensah', email:'adwoa@oasistravel.com', initials:'AM', avatarBg:'#7C5CFC', role:'Agent', roleBg:'#F0EBFF', roleFg:'#7C5CFC', active:'2h ago', you:false},
    {name:'Yaw Boateng', email:'yaw@oasistravel.com', initials:'YB', avatarBg:'#0E9F6E', role:'Agent', roleBg:'#F0EBFF', roleFg:'#7C5CFC', active:'Yesterday', you:false},
    {name:'Efua Osei', email:'efua@oasistravel.com', initials:'EO', avatarBg:'#B7791F', role:'Finance', roleBg:'#FFF3E0', roleFg:'#B7791F', active:'3 days ago', you:false},
    {name:'Kofi Asare', email:'kofi@oasistravel.com', initials:'KA', avatarBg:'#C2410C', role:'Agent', roleBg:'#F0EBFF', roleFg:'#7C5CFC', active:'1 week ago', you:false},
  ];
  return raw.map(m => ({
    ...m, youDisplay: m.you ? 'inline' as const : 'none' as const,
    menu: () => {},
  }));
}

// Mock role definitions (Super admin/Agent/Finance/Read-only) with permission checklists.
// Note this role vocabulary doesn't match the real backend's CompanyRole enum
// (owner/admin/member) — Settings.tsx's real Roles tab computes its own role breakdown
// from actual company users rather than using this. Orphaned — see teamMembers() above.
export function rolesData(): RoleDef[] {
  const yes = 'M20 6 9 17l-5-5';
  const no = 'M18 6 6 18M6 6l12 12';
  const raw = [
    {name:'Super admin', count:1, icon:'★', iconBg:'#EAF0FF',
     desc:'Full access across the workspace, including billing and seats.',
     perms:[[yes,'Manage billing & seats'],[yes,'Add, remove & assign roles'],[yes,'Create and edit every trip'],[yes,'View all financials']]},
    {name:'Agent', count:3, icon:'🧳', iconBg:'#F0EBFF',
     desc:'Day-to-day trip building and traveller conversations.',
     perms:[[yes,'Create and manage trips'],[yes,'Message travellers on all channels'],[yes,'Run & summarise calls'],[no,'No access to billing']]},
    {name:'Finance', count:1, icon:'💳', iconBg:'#FFF3E0',
     desc:'Money, invoices and reconciliation — no trip editing.',
     perms:[[yes,'View financials & payouts'],[yes,'Manage invoices & deposits'],[yes,'Export statements'],[no,'Cannot edit trips']]},
    {name:'Read-only', count:0, icon:'👁', iconBg:'#EEF0F4',
     desc:'View access for observers, trainees and partners.',
     perms:[[yes,'View trips & travellers'],[yes,'View call summaries'],[no,'Cannot edit or send'],[no,'Cannot see financials']]},
  ];
  return raw.map(r => ({
    ...r,
    countLabel: r.count + (r.count === 1 ? ' member' : ' members'),
    perms: r.perms.map(([icon,label]) => ({icon, label, color: icon === yes ? '#0E9F6E' : '#C2410C'})),
  }));
}

// Mock connected-channels list for the Settings > Channels tab. Orphaned — see teamMembers()
// above; Settings.tsx's real ChannelsSection renders its own hardcoded channel list instead.
export function channelsData(toast: (msg: string) => void, openConnectFor: (n: string) => void): Channel[] {
  const raw = [
    {name:'WhatsApp Business', icon:'💬', iconBg:'#E3F7EF', sub:'+233 24 555 0192 · Oasis Travel', connected:true},
    {name:'Gmail', icon:'✉️', iconBg:'#FFE9E6', sub:'bookings@oasistravel.com', connected:true},
    {name:'Instagram', icon:'📷', iconBg:'#F0EBFF', sub:'Connect your linked business account', connected:false},
  ];
  return raw.map(c => ({
    ...c,
    connDisplay: c.connected ? 'inline-flex' as const : 'none' as const,
    btnLabel: c.connected ? 'Disconnect' : 'Connect',
    btnBg: c.connected ? '#fff' : '#2B63F6',
    btnFg: c.connected ? '#5B6172' : '#fff',
    btnBorder: c.connected ? '#DDE0E8' : '#2B63F6',
    action: () => { if (c.connected) { toast(c.name + ' disconnected'); } else { openConnectFor(c.name); } },
  }));
}

// Initial values for AppContext's own `notifs` state (used to seed useState in AppProvider).
// The resulting toggles are only ever surfaced via getTeamData().notifSettings, which is
// orphaned (see teamMembers() above) — Settings.tsx's real Notifications tab keeps its own
// separate local state instead, so toggling AppContext's copy has no visible effect anywhere.
export function notifDefaults(): Record<string, boolean> {
  return {
    newMessage: true,
    tripAccepted: true,
    paymentReceived: true,
    callSummary: true,
    weeklyDigest: false,
    productUpdates: false,
  };
}

// Combines notifDefaults()-shaped state with display metadata for the (orphaned) Team &
// Seats notification toggles — see notifDefaults() above.
export function notificationsData(
  notifs: Record<string, boolean>,
  toggle: (k: string) => void
): NotifSetting[] {
  const defs: [string,string,string][] = [
    ['newMessage','New traveller message','When a client replies on any channel'],
    ['tripAccepted','Trip accepted','When a traveller accepts a shared trip'],
    ['paymentReceived','Payment received','When a deposit or balance lands via Paystack'],
    ['callSummary','Call summary ready','When Meridian finishes processing a call'],
    ['weeklyDigest','Weekly digest','A Monday summary of your agency\'s week'],
    ['productUpdates','Product updates','New Meridian features and improvements'],
  ];
  return defs.map(([k, t, d]) => ({
    key: k, title: t, desc: d,
    on: !!notifs[k],
    trackBg: notifs[k] ? '#13B981' : '#D9DCE4',
    knobX: notifs[k] ? '20px' : '2px',
    toggle: () => toggle(k),
  }));
}

// Mock onboarding checklist. Reachable via AppContext.getOnboardTasks(), but Dashboard.tsx
// builds its own local onboarding task list instead — effectively orphaned.
export function onboardTasks(openGenItin: () => void): OnboardingTask[] {
  return [
    {slot:'ob-connect', icon:'💬', title:'Connect a channel', desc:'Bring WhatsApp, Gmail or Instagram into Meridian.', done:true, todo:false, ph:'Drop a workspace photo'},
    {slot:'ob-trip', icon:'🧳', title:'Create first trip', desc:'Set up your first travel experience to share with travelers.', done:true, todo:false, ph:'Drop a travel photo'},
    {slot:'ob-itin', icon:'✦', title:'Generate first itinerary', desc:'Let Meridian automate your first itinerary creation.', done:false, todo:true, cta:'Generate itinerary', action:openGenItin, ph:'Drop a planning photo'},
  ];
}

// Cover gradient per guide article id — used below in guidesData() and (as its own
// smaller local copy) in Dashboard.tsx's onboarding "How Meridian works" cards.
export const guideCovers: Record<string, string> = {
  connect: 'linear-gradient(135deg,#1B5BBE,#5AA0FF)',
  trip: 'linear-gradient(135deg,#0E7C8F,#36C5C0)',
  draft: 'linear-gradient(135deg,#7C3AED,#B58CF5)',
  share: 'linear-gradient(135deg,#E08A2B,#F5C06B)',
  calls: 'linear-gradient(135deg,#C2410C,#F59E5B)',
  inbox: 'linear-gradient(135deg,#15803D,#5DBE7E)',
};

// The 6 help-center guide articles (Help.tsx list + GuideArticle.tsx detail view). Actively
// used: `cards`/`featured` feed Help.tsx, and `article(id)` feeds GuideArticle.tsx.
// `worksCards` (first 4, title/cover only) isn't currently rendered by any page.
export function guidesData(openGuide: (id: string) => void): {
  cards: GuideCard[];
  worksCards: GuideCard[];
  featured: GuideCard;
  article: (id: string) => GuideArticle;
} {
  const gz = guideCovers;

  const guideDefs: {
    id: string; cat: string; catBg: string; catFg: string; icon: string; cover: string;
    read: string; updated: string; title: string; videoTitle: string; excerpt: string;
    sections: { h: string; paras: string[]; shot?: boolean; shotLabel?: string; tip?: string }[];
  }[] = [
    {id:'connect', cat:'Getting started', catBg:'#EAF0FF', catFg:'#2B63F6', icon:'💬', cover:gz.connect, read:'4 min read', updated:'Updated Jun 2026',
     title:'Connect your channels', videoTitle:'Connecting WhatsApp in 2 minutes',
     excerpt:'Bring WhatsApp, Gmail and Instagram into one inbox so every enquiry lands in Meridian automatically.',
     sections:[
       {h:'Why connect your channels', paras:['Travellers reach you everywhere — a WhatsApp at midnight, an email on Monday, a DM mid-week. When those live in separate apps, context gets lost and replies get slow.','Connecting a channel lets Meridian pull every message into one inbox, tagged to the right traveller and trip, so nothing slips.'], shot:true, shotLabel:'The Channels screen in Settings'},
       {h:'Connect WhatsApp', paras:['Open Settings → Channels and choose WhatsApp. Scan the QR code with the phone you use for business, exactly like WhatsApp Web.','Once linked, new chats appear in your Meridian inbox within seconds — and you can reply right from Meridian.'], tip:'Use your business number, not a personal one — Meridian keeps client chats separate from your private messages.'},
       {h:'Add Gmail & Instagram', paras:['Repeat the same flow for Gmail and Instagram. For Gmail you authorise with Google; for Instagram you connect your linked business account.','That\'s it — every enquiry across all three now lands in one place.'], shot:true, shotLabel:'All three channels connected'},
     ]},
    {id:'trip', cat:'Core workflow', catBg:'#E3F7EF', catFg:'#0E9F6E', icon:'🧳', cover:gz.trip, read:'5 min read', updated:'Updated Jun 2026',
     title:'Create your first trip', videoTitle:'From a brief to a trip workspace',
     excerpt:'Turn a traveller\'s request into a structured trip workspace that Meridian can build on.',
     sections:[
       {h:'Start with the brief', paras:['Hit New trip and give Meridian the essentials — a name, the request in plain words, who\'s travelling and when. The more context you add, the sharper the draft.','You can paste straight from a WhatsApp message or a call summary; Meridian reads it and fills in what it can.'], shot:true, shotLabel:'The Create a trip dialog'},
       {h:'Let Meridian search', paras:['Once you generate, Meridian scans flights, sea-view stays and experiences across your connected sources and ranks them against the traveller\'s stated taste — budget, dates and preferences.','In under a minute you get three complete itinerary options to review.'], tip:'Trips always start from a brief — so even a one-line request becomes a full workspace you can refine.'},
       {h:'Refine the workspace', paras:['Every trip opens into a builder with tabs for the itinerary, flights, stays, activities and call notes. Swap any block, add Meridian\'s suggestions, and watch the cost summary update live.'], shot:true, shotLabel:'The trip builder with three options'},
     ]},
    {id:'draft', cat:'AI drafting', catBg:'#F0EBFF', catFg:'#7C5CFC', icon:'✦', cover:gz.draft, read:'4 min read', updated:'Updated Jun 2026',
     title:'How Meridian drafts itineraries', videoTitle:'Inside the drafting engine',
     excerpt:'Understand how Meridian turns a brief into three ranked, ready-to-send itinerary options.',
     sections:[
       {h:'Three options, every time', paras:['Meridian never gives you a single take-it-or-leave-it plan. It builds three distinct options at different angles — a safe pick, a wildcard and a value choice — so your traveller feels they\'re choosing.','Each option is complete: flights, stays, day-by-day activities and a transparent cost breakdown.'], shot:true, shotLabel:'Three itinerary options side by side'},
       {h:'Ranked to taste', paras:['The engine weighs everything it knows — budget ceiling, dietary needs, max stops, the vibe from the discovery call — and marks its top recommendation with an AI pick badge.'], tip:'You always approve before anything is sent. Meridian drafts; you decide.'},
       {h:'Edit anything', paras:['Don\'t love a hotel? Swap it and the totals re-rank instantly. Meridian learns from your edits to draft closer to your style next time.'], shot:false},
     ]},
    {id:'share', cat:'Money', catBg:'#FFF3E0', catFg:'#B7791F', icon:'💳', cover:gz.share, read:'5 min read', updated:'Updated Jun 2026',
     title:'Share trips & get paid', videoTitle:'From shared trip to reconciled payment',
     excerpt:'Send a beautiful traveller view, collect deposits via Paystack and let invoices reconcile themselves.',
     sections:[
       {h:'The traveller view', paras:['Share a trip and your client gets a clean, branded page — hero, day-by-day plan and a single price. They can accept or request changes in one tap, no login required.'], shot:true, shotLabel:'The shareable traveller view'},
       {h:'Collect the deposit', paras:['When they accept, Meridian generates a quote and a secure Paystack link. Deposits land in your account and the trip moves to booking automatically.'], tip:'Payments stay between you, your client and Paystack — Meridian just keeps everything in sync.'},
       {h:'Reconciled books', paras:['Every payment matches itself to the right invoice and trip. Your Financials tab always shows current revenue, outstanding balances and the next payout.'], shot:true, shotLabel:'The Financials tab with payouts'},
     ]},
    {id:'calls', cat:'Calls & notes', catBg:'#FFF3E0', catFg:'#C2410C', icon:'🎙️', cover:gz.calls, read:'3 min read', updated:'Updated Jun 2026',
     title:'Turn calls into action points', videoTitle:'Never lose what was said on a call',
     excerpt:'Let Meridian join, transcribe and summarise discovery calls — with action points attached to the trip.',
     sections:[
       {h:'Capture the call', paras:['Add Meridian to a discovery call and it listens, transcribes and writes a clean summary the moment you hang up — no note-taking while you talk.'], shot:true, shotLabel:'A processed call summary'},
       {h:'Action points & decisions', paras:['Meridian pulls out the to-dos — send options by Friday, confirm dietary needs — and the decisions made, then pins them to the trip so nothing is forgotten.'], tip:'Action points become a checklist on the trip, so the whole team stays aligned.'},
     ]},
    {id:'inbox', cat:'Conversations', catBg:'#E3F7EF', catFg:'#15803D', icon:'📥', cover:gz.inbox, read:'4 min read', updated:'Updated Jun 2026',
     title:'Master the unified inbox', videoTitle:'One inbox for every channel',
     excerpt:'Work WhatsApp, Gmail and Instagram from a single thread per traveller — with AI-drafted replies.',
     sections:[
       {h:'One thread per traveller', paras:['No more hunting across apps. Every message from a client — whichever channel it came in on — sits in one thread, with the linked trip and call notes a click away.'], shot:true, shotLabel:'The unified inbox'},
       {h:'AI-drafted replies', paras:['Meridian suggests a reply in your voice, using the trip context. Tweak it or send as-is — either way you answer in seconds, not hours.'], tip:'Drafts pull from the discovery call, so replies always reflect what the traveller actually wants.'},
     ]},
  ];

  const cards: GuideCard[] = guideDefs.map(g => ({
    title: g.title, excerpt: g.excerpt, cover: g.cover,
    cat: g.cat, catBg: g.catBg, catFg: g.catFg, read: g.read, icon: g.icon,
    open: () => openGuide(g.id),
  }));

  const worksCards: GuideCard[] = guideDefs.slice(0, 4).map(g => ({
    title: g.title, excerpt: '', cover: g.cover,
    cat: g.cat, catBg: '', catFg: '', read: '', icon: '',
    open: () => openGuide(g.id),
  }));

  const featured: GuideCard = { ...cards[0] };

  const article = (id: string): GuideArticle => {
    const gi = Math.max(0, guideDefs.findIndex(g => g.id === id));
    const gd = guideDefs[gi];
    const nextGd = guideDefs[(gi + 1) % guideDefs.length];
    return {
      title: gd.title, cat: gd.cat, catBg: gd.catBg, catFg: gd.catFg,
      cover: gd.cover, read: gd.read, updated: gd.updated,
      videoTitle: gd.videoTitle, videoSlot: gd.id + '-video',
      sections: gd.sections.map((s,i) => ({
        h: s.h, paras: s.paras,
        hasShot: !!s.shot, shotSlot: gd.id + '-shot-' + i, shotLabel: s.shotLabel || '',
        hasTip: !!s.tip, tip: s.tip || '',
      })),
      nextTitle: nextGd.title, nextCat: nextGd.cat, nextOpen: () => openGuide(nextGd.id),
    };
  };

  return { cards, worksCards, featured, article };
}

// The channel picker list shown on step 1 of ConnectChannelModal (WhatsApp/Gmail/Instagram).
export function connectPickList(pickChannel: (n: string) => void): ConnectPickItem[] {
  return [
    {name:'WhatsApp Business', icon:'💬', iconBg:'#E3F7EF', sub:'Link with a QR code, like WhatsApp Web', pick: () => pickChannel('WhatsApp Business')},
    {name:'Gmail', icon:'✉️', iconBg:'#FFE9E6', sub:'Authorise with your Google account', pick: () => pickChannel('Gmail')},
    {name:'Instagram', icon:'📷', iconBg:'#F0EBFF', sub:'Connect a linked business account', pick: () => pickChannel('Instagram')},
  ];
}

// Per-channel copy/mock-imported-contacts shown on the later steps of ConnectChannelModal
// (auth instructions, then a fake "synced N contacts" summary) — this whole flow is a UI
// simulation with a setTimeout in AppContext.connectGo(), not a real channel integration.
export function connectChannelView(name: string | null): ConnectChannelView | null {
  if (!name) return null;
  const cfg: Record<string, {
    short: string; icon: string; iconBg: string; mode: string;
    authTitle: string; authBody: string; cta: string; synced: string;
    createdN: number; reviewN: number;
    contacts: { name: string; initials: string; avatarBg: string; source: string; tag: string; tagBg: string; tagFg: string }[];
  }> = {
    'WhatsApp Business': {short:'WhatsApp', icon:'💬', iconBg:'#E3F7EF', mode:'qr',
      authTitle:'Scan to link WhatsApp', authBody:'On your phone, open WhatsApp → Settings → Linked devices → Link a device, then point your camera at this code.',
      cta:'I\'ve scanned the code', synced:'142 chats', createdN:38, reviewN:4,
      contacts:[
        {name:'Ama Asante', initials:'AA', avatarBg:'#2B63F6', source:'Name from WhatsApp profile', tag:'New traveler', tagBg:'#E3F7EF', tagFg:'#0E9F6E'},
        {name:'Kojo Adjei', initials:'KA', avatarBg:'#7C5CFC', source:'Name from WhatsApp profile', tag:'New traveler', tagBg:'#E3F7EF', tagFg:'#0E9F6E'},
        {name:'Yaa Boateng', initials:'YB', avatarBg:'#0E9F6E', source:'Same number as an existing traveler', tag:'Merged', tagBg:'#EAF0FF', tagFg:'#2B63F6'},
        {name:'+233 24 991 2030', initials:'#', avatarBg:'#B7791F', source:'No profile name saved — add one', tag:'Needs review', tagBg:'#FFF3E0', tagFg:'#B7791F'},
      ]},
    'Gmail': {short:'Gmail', icon:'✉️', iconBg:'#FFE9E6', mode:'account',
      authTitle:'Choose a Google account', authBody:'Meridian reads incoming enquiries and lets you reply from your inbox. You can disconnect at any time.',
      cta:'Continue with Google', synced:'320 threads', createdN:54, reviewN:6,
      contacts:[
        {name:'Linda Mensah', initials:'LM', avatarBg:'#2B63F6', source:'Name from the email "From" field', tag:'New traveler', tagBg:'#E3F7EF', tagFg:'#0E9F6E'},
        {name:'David Otoo', initials:'DO', avatarBg:'#7C5CFC', source:'Name from the email "From" field', tag:'New traveler', tagBg:'#E3F7EF', tagFg:'#0E9F6E'},
        {name:'Owusu Group', initials:'OG', avatarBg:'#0E9F6E', source:'Matched to an existing traveler', tag:'Merged', tagBg:'#EAF0FF', tagFg:'#2B63F6'},
      ]},
    'Instagram': {short:'Instagram', icon:'📷', iconBg:'#F0EBFF', mode:'account',
      authTitle:'Connect your Instagram business account', authBody:'Log in to the business account linked to your page. Meridian brings DMs into your unified inbox.',
      cta:'Connect account', synced:'64 conversations', createdN:21, reviewN:3,
      contacts:[
        {name:'travelwithefua', initials:'TE', avatarBg:'#2B63F6', source:'Name from the Instagram handle', tag:'New traveler', tagBg:'#E3F7EF', tagFg:'#0E9F6E'},
        {name:'kofi.explores', initials:'KE', avatarBg:'#7C5CFC', source:'Name from the Instagram handle', tag:'New traveler', tagBg:'#E3F7EF', tagFg:'#0E9F6E'},
        {name:'Adjei Family', initials:'AF', avatarBg:'#0E9F6E', source:'Matched to an existing traveler', tag:'Merged', tagBg:'#EAF0FF', tagFg:'#2B63F6'},
      ]},
  };
  const cc = cfg[name];
  if (!cc) return null;
  return {
    short: cc.short, icon: cc.icon, iconBg: cc.iconBg,
    isQr: cc.mode === 'qr', isAccount: cc.mode === 'account',
    authTitle: cc.authTitle, authBody: cc.authBody,
    cta: cc.cta, synced: cc.synced,
    createdLabel: cc.createdN + ' travelers created',
    reviewLabel: cc.reviewN + ' need review',
    moreLabel: '+ ' + (cc.createdN - cc.contacts.filter(c => c.tag === 'New traveler').length) + ' more imported',
    contacts: cc.contacts,
  };
}
