import type { DeviceType, ProblemTag } from "@/lib/types";

/** Reference lists the seed draws from, and Settings later edits. */

export const FIRST_NAMES = [
  "Maria",
  "Jose",
  "Ana",
  "Juan",
  "Rosario",
  "Antonio",
  "Grace",
  "Ronaldo",
  "Jenny",
  "Mark",
  "Kristine",
  "Paolo",
  "Divina",
  "Christian",
  "Michelle",
  "Rafael",
  "Angelica",
  "Dennis",
  "Liza",
  "Emmanuel",
  "Precious",
  "Arnel",
  "Jasmine",
  "Rico",
  "Marilou",
  "Jayson",
  "Cherry",
  "Noel",
  "Aileen",
  "Bryan",
];

export const LAST_NAMES = [
  "Santos",
  "Reyes",
  "Cruz",
  "Bautista",
  "Ocampo",
  "Garcia",
  "Mendoza",
  "Torres",
  "Domingo",
  "Villanueva",
  "Ramos",
  "Aquino",
  "Del Rosario",
  "Flores",
  "Gonzales",
  "Castillo",
  "Navarro",
  "Salazar",
  "Manalo",
  "Dela Peña",
  "Lim",
  "Tan",
  "Sy",
  "Pascual",
  "Rivera",
];

export const MOBILE_PREFIXES = [
  "0917",
  "0918",
  "0919",
  "0920",
  "0927",
  "0935",
  "0939",
  "0945",
  "0956",
  "0966",
  "0977",
  "0995",
];

export interface ModelRef {
  brand: string;
  model: string;
  type: DeviceType;
  /** Rough street value, used for handset pricing and trade-in offers. */
  tier: number;
}

export const MODELS: ModelRef[] = [
  { brand: "Apple", model: "iPhone 11", type: "phone", tier: 14000 },
  { brand: "Apple", model: "iPhone 12", type: "phone", tier: 19000 },
  { brand: "Apple", model: "iPhone 13", type: "phone", tier: 27000 },
  { brand: "Apple", model: "iPhone 14", type: "phone", tier: 36000 },
  { brand: "Apple", model: "iPhone 15", type: "phone", tier: 46000 },
  { brand: "Apple", model: "iPhone XR", type: "phone", tier: 11000 },
  { brand: "Samsung", model: "Galaxy A15", type: "phone", tier: 8500 },
  { brand: "Samsung", model: "Galaxy A35", type: "phone", tier: 14500 },
  { brand: "Samsung", model: "Galaxy A54", type: "phone", tier: 17500 },
  { brand: "Samsung", model: "Galaxy S22", type: "phone", tier: 28000 },
  { brand: "Samsung", model: "Galaxy S23", type: "phone", tier: 38000 },
  { brand: "Xiaomi", model: "Redmi Note 12", type: "phone", tier: 8000 },
  { brand: "Xiaomi", model: "Redmi Note 13", type: "phone", tier: 10500 },
  { brand: "Xiaomi", model: "Poco X6", type: "phone", tier: 14000 },
  { brand: "Realme", model: "C55", type: "phone", tier: 7500 },
  { brand: "Realme", model: "11 Pro", type: "phone", tier: 16000 },
  { brand: "Oppo", model: "A78", type: "phone", tier: 9500 },
  { brand: "Oppo", model: "Reno 11", type: "phone", tier: 21000 },
  { brand: "Vivo", model: "Y17s", type: "phone", tier: 6500 },
  { brand: "Vivo", model: "V29", type: "phone", tier: 19500 },
  { brand: "Infinix", model: "Hot 40i", type: "phone", tier: 5500 },
  { brand: "Tecno", model: "Spark 20", type: "phone", tier: 5200 },
  { brand: "Huawei", model: "Nova 11i", type: "phone", tier: 11500 },
  { brand: "Apple", model: 'iPad 9th gen', type: "tablet", tier: 17000 },
  { brand: "Samsung", model: "Galaxy Tab A9", type: "tablet", tier: 9500 },
  { brand: "Apple", model: "Apple Watch SE", type: "smartwatch", tier: 13000 },
  { brand: "Samsung", model: "Galaxy Watch 6", type: "smartwatch", tier: 15000 },
  { brand: "Lenovo", model: "IdeaPad Slim 3", type: "laptop", tier: 27000 },
  { brand: "Acer", model: "Aspire 5", type: "laptop", tier: 30000 },
];

export const COLORS = [
  "Black",
  "White",
  "Midnight",
  "Starlight",
  "Blue",
  "Graphite",
  "Silver",
  "Green",
  "Lavender",
  "Gold",
];

export const PROBLEM_TAGS: ProblemTag[] = [
  "screen",
  "battery",
  "charging_port",
  "water_damage",
  "no_power",
  "software",
  "camera",
  "speaker",
  "board_level",
];

export const PROBLEM_LABEL: Record<ProblemTag, string> = {
  screen: "Screen",
  battery: "Battery",
  charging_port: "Charging port",
  water_damage: "Water damage",
  no_power: "No power",
  software: "Software",
  camera: "Camera",
  speaker: "Speaker",
  board_level: "Board-level",
};

/** What a customer actually says at the counter, per tag. */
export const REPORTED_PROBLEM: Record<ProblemTag, string[]> = {
  screen: [
    "Nabagsak, basag ang screen pero gumagana pa raw.",
    "Screen has black ink spreading from the corner.",
    "Touch is dead on the right side of the display.",
  ],
  battery: [
    "Battery drains from 100% to 20% in two hours.",
    "Namamaga ang battery, umaangat ang screen.",
    "Shuts down at 30% then needs a charger to restart.",
  ],
  charging_port: [
    "Kailangan i-angle ang cable bago mag-charge.",
    "Charging port is loose, only charges when pressed.",
    "Not charging with any cable, tried three chargers.",
  ],
  water_damage: [
    "Nahulog sa CR, naka-rice for two days.",
    "Got rained on, screen flickers and speaker is muffled.",
    "Spilled soda on it, now it restarts on its own.",
  ],
  no_power: [
    "Walang display, hindi nagre-respond kahit i-charge.",
    "Dead after a firmware update, no boot logo.",
    "Fell from the table and never turned on again.",
  ],
  software: [
    "Stuck sa boot logo pagkatapos mag-update.",
    "Forgot the Google account after a factory reset.",
    "Very slow, lots of pop-up ads after installing an app.",
  ],
  camera: [
    "Rear camera is blurry, front camera is fine.",
    "Camera app crashes when switching to video.",
    "May dust sa loob ng camera lens.",
  ],
  speaker: [
    "Earpiece is very low on calls, loudspeaker is fine.",
    "Walang tunog sa ringtone pero okay ang headset.",
    "Crackling sound at high volume.",
  ],
  board_level: [
    "For reballing daw, sabi ng ibang shop.",
    "Heats up near the camera then shuts down.",
    "No service after a screen replacement elsewhere.",
  ],
};

export const DIAGNOSIS_NOTES = [
  "Confirmed the reported fault on bench test. Display assembly needs replacement.",
  "Battery health at 71%, swollen cell. Recommending replacement.",
  "Charging port pins corroded. Port flex replacement needed.",
  "Board shows liquid damage on the shield. Ultrasonic clean done, testing.",
  "Firmware corrupted. Reflash and data preserved where possible.",
  "Camera module fails on the second lens. Module swap required.",
  "Earpiece mesh clogged and speaker coil open. Speaker assembly swap.",
  "Power IC suspected. Requires micro-soldering, quoting board-level rate.",
];

export const ROOT_CAUSES = [
  "Drop impact",
  "Liquid ingress",
  "Component wear",
  "Third-party parts from a previous repair",
  "Firmware corruption",
  "Manufacturing defect",
  "Power surge from a non-original charger",
];

export interface PartRef {
  name: string;
  category: string;
  cost: number;
  price: number;
  models: string[];
}

export const SPARE_PARTS: PartRef[] = [
  { name: "LCD assembly (incell)", category: "Display", cost: 1450, price: 2600, models: ["iPhone 11", "iPhone XR"] },
  { name: "OLED assembly (original pull)", category: "Display", cost: 4200, price: 6800, models: ["iPhone 12", "iPhone 13"] },
  { name: "LCD assembly", category: "Display", cost: 1250, price: 2350, models: ["Galaxy A15", "Galaxy A35"] },
  { name: "AMOLED assembly with frame", category: "Display", cost: 3100, price: 5200, models: ["Galaxy A54", "Galaxy S22"] },
  { name: "LCD assembly", category: "Display", cost: 980, price: 1850, models: ["Redmi Note 12", "Redmi Note 13"] },
  { name: "LCD assembly", category: "Display", cost: 890, price: 1750, models: ["C55", "A78", "Y17s"] },
  { name: "Battery", category: "Power", cost: 620, price: 1250, models: ["iPhone 11", "iPhone 12"] },
  { name: "Battery", category: "Power", cost: 540, price: 1100, models: ["iPhone 13", "iPhone 14"] },
  { name: "Battery", category: "Power", cost: 380, price: 850, models: ["Galaxy A54", "Galaxy A35"] },
  { name: "Battery", category: "Power", cost: 320, price: 750, models: ["Redmi Note 12", "Poco X6"] },
  { name: "Charging port flex", category: "Charging", cost: 220, price: 650, models: ["iPhone 11", "iPhone 12", "iPhone 13"] },
  { name: "Charging port board (Type-C)", category: "Charging", cost: 180, price: 550, models: ["Galaxy A54", "Redmi Note 13", "C55"] },
  { name: "Back glass with lens", category: "Housing", cost: 450, price: 1200, models: ["iPhone 12", "iPhone 13"] },
  { name: "Rear camera module", category: "Camera", cost: 760, price: 1650, models: ["iPhone 12", "Galaxy A54"] },
  { name: "Front camera flex", category: "Camera", cost: 340, price: 850, models: ["iPhone 11", "Redmi Note 12"] },
  { name: "Loudspeaker module", category: "Audio", cost: 210, price: 600, models: ["iPhone 11", "iPhone 12", "Galaxy A54"] },
  { name: "Earpiece speaker", category: "Audio", cost: 150, price: 450, models: ["Redmi Note 12", "C55", "A78"] },
  { name: "Power/volume flex", category: "Housing", cost: 190, price: 550, models: ["iPhone 11", "iPhone 12"] },
  { name: "Tempered adhesive kit", category: "Consumable", cost: 45, price: 150, models: ["Universal"] },
  { name: "Waterproof seal tape", category: "Consumable", cost: 60, price: 180, models: ["Universal"] },
  { name: "Thermal paste tube", category: "Consumable", cost: 120, price: 320, models: ["Universal"] },
  { name: "Screw set", category: "Consumable", cost: 35, price: 120, models: ["Universal"] },
  { name: "Tablet digitizer", category: "Display", cost: 1600, price: 2900, models: ["iPad 9th gen", "Galaxy Tab A9"] },
  { name: "Laptop keyboard", category: "Input", cost: 1100, price: 2200, models: ["IdeaPad Slim 3", "Aspire 5"] },
  { name: "Watch screen assembly", category: "Display", cost: 1800, price: 3200, models: ["Apple Watch SE", "Galaxy Watch 6"] },
];

export interface AccessoryRef {
  name: string;
  category: string;
  brand: string;
  cost: number;
  price: number;
}

export const ACCESSORIES: AccessoryRef[] = [
  { name: "Tempered glass 9H (clear)", category: "Protection", brand: "Generic", cost: 25, price: 150 },
  { name: "Tempered glass privacy", category: "Protection", brand: "Generic", cost: 60, price: 250 },
  { name: "Silicone case (assorted)", category: "Protection", brand: "Generic", cost: 45, price: 199 },
  { name: "Shockproof case", category: "Protection", brand: "Spigen-style", cost: 180, price: 499 },
  { name: "20W USB-C charger", category: "Charging", brand: "Generic", cost: 210, price: 549 },
  { name: "33W fast charger", category: "Charging", brand: "Generic", cost: 320, price: 749 },
  { name: "USB-C to Lightning cable 1m", category: "Charging", brand: "Generic", cost: 95, price: 299 },
  { name: "USB-C to USB-C cable 1m", category: "Charging", brand: "Generic", cost: 85, price: 279 },
  { name: "Powerbank 10000mAh", category: "Charging", brand: "Aukey-style", cost: 480, price: 999 },
  { name: "Powerbank 20000mAh", category: "Charging", brand: "Aukey-style", cost: 760, price: 1499 },
  { name: "TWS earbuds", category: "Audio", brand: "Generic", cost: 420, price: 999 },
  { name: "Wired earphones 3.5mm", category: "Audio", brand: "Generic", cost: 65, price: 199 },
  { name: "Bluetooth speaker", category: "Audio", brand: "Generic", cost: 620, price: 1299 },
  { name: "MicroSD 64GB", category: "Storage", brand: "SanDisk", cost: 290, price: 599 },
  { name: "MicroSD 128GB", category: "Storage", brand: "SanDisk", cost: 480, price: 899 },
  { name: "OTG adapter", category: "Accessory", brand: "Generic", cost: 40, price: 149 },
  { name: "Phone holder (car)", category: "Accessory", brand: "Generic", cost: 110, price: 349 },
  { name: "Ring holder", category: "Accessory", brand: "Generic", cost: 20, price: 99 },
  { name: "Selfie stick tripod", category: "Accessory", brand: "Generic", cost: 190, price: 499 },
  { name: "SIM ejector pin (pack of 5)", category: "Accessory", brand: "Generic", cost: 15, price: 60 },
  { name: "Screen cleaning kit", category: "Accessory", brand: "Generic", cost: 55, price: 179 },
  { name: "Watch strap 20mm", category: "Accessory", brand: "Generic", cost: 90, price: 299 },
  { name: "Laptop sleeve 14\"", category: "Accessory", brand: "Generic", cost: 210, price: 549 },
  { name: "Wireless charging pad", category: "Charging", brand: "Generic", cost: 260, price: 649 },
  { name: "Prepaid SIM card", category: "Telco", brand: "Globe", cost: 30, price: 50 },
];

export const SUPPLIERS = [
  { name: "Gilmore Parts Center", contactPerson: "Ricky Uy", terms: "COD" },
  { name: "Raon Cellphone Supplies", contactPerson: "Mila Chua", terms: "7 days" },
  { name: "Greenhills Wholesale Hub", contactPerson: "Ferdie Lim", terms: "15 days" },
  { name: "Shenzhen Direct (Lazada)", contactPerson: "Online", terms: "Prepaid" },
  { name: "Cyberzone Distributors", contactPerson: "Joel Trinidad", terms: "30 days" },
];

export const SERVICES = [
  { code: "SVC-SCRN", name: "Screen replacement (labor)", category: "Repair", standardPrice: 800, estimatedMinutes: 60, warrantyDays: 30 },
  { code: "SVC-BATT", name: "Battery replacement (labor)", category: "Repair", standardPrice: 400, estimatedMinutes: 30, warrantyDays: 90 },
  { code: "SVC-PORT", name: "Charging port repair", category: "Repair", standardPrice: 600, estimatedMinutes: 45, warrantyDays: 30 },
  { code: "SVC-LIQ", name: "Liquid damage treatment", category: "Repair", standardPrice: 1200, estimatedMinutes: 180, warrantyDays: 0 },
  { code: "SVC-SOFT", name: "Software reflash / unlock", category: "Software", standardPrice: 500, estimatedMinutes: 60, warrantyDays: 7 },
  { code: "SVC-BOARD", name: "Board-level micro-soldering", category: "Repair", standardPrice: 2500, estimatedMinutes: 240, warrantyDays: 15 },
  { code: "SVC-CLEAN", name: "Deep clean and check-up", category: "Service", standardPrice: 300, estimatedMinutes: 30, warrantyDays: 0 },
  { code: "SVC-TRANS", name: "Data transfer / backup", category: "Service", standardPrice: 350, estimatedMinutes: 45, warrantyDays: 0 },
  { code: "SVC-DIAG", name: "Diagnostic fee", category: "Service", standardPrice: 200, estimatedMinutes: 20, warrantyDays: 0 },
];

export const BARANGAYS = [
  "Brgy. Bagong Silang, Caloocan",
  "Brgy. Kapitolyo, Pasig",
  "Brgy. San Antonio, Makati",
  "Brgy. Holy Spirit, Quezon City",
  "Brgy. Poblacion, Mandaluyong",
  "Brgy. Sto. Niño, Marikina",
  "Brgy. Talon Dos, Las Piñas",
  "Brgy. Sun Valley, Parañaque",
  "Brgy. Malanday, Valenzuela",
  "Brgy. Tondo, Manila",
];
